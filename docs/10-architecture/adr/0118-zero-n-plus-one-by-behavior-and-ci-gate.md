---
id: 0118
title: Zero N+1 por comportamiento, precarga acotada y gate de CI
status: Accepted
date: 2026-11-06
author: core-team
---

# ADR-0118 — Zero N+1 por comportamiento, precarga acotada y gate de CI

**Relacionado:** [zero-n-plus-one-policy.md](../../90-governance/zero-n-plus-one-policy.md), [performance.md](../../40-quality/performance.md), [testing.md](../../40-quality/testing.md), [ci-cd.md](../../40-quality/ci-cd.md), [ADR-0117](0117-minimal-user-in-task-responses.md).

## Contexto

El PR #209 corrigió los listados más costosos detectados con Sentry. Con datos reales, 50 órdenes de compra hacían 211 queries y 50 órdenes de venta, 199. Al contrastar esos casos con los contratos aparecieron cuatro causas:

1. **La regla describía un síntoma.** Prohibía `.objects` en serializers. Órdenes de venta hacía sus queries por propiedades del modelo (`qty_available`) y tareas con `groups.select_related().all()`: cumplían la regla y tenían N+1.
2. **Solo había un mínimo de precarga, no un máximo.** El listado de productos unía 8 relaciones de las que leía 3. Postgres tardaba ~300 ms en planificar la query y ~5 ms en ejecutarla.
3. **Los tests no representaban los datos.** `sales/tests/test_performance.py` listaba órdenes sin líneas con un máximo de 15 queries y pasaba mientras los datos reales hacían 199.
4. **Nada se hacía cumplir.** `CI Pipeline` está deshabilitado manualmente desde abril de 2026, `master` no tiene protección de rama y la suite no bloqueaba. Los documentos afirmaban lo contrario y citaban herramientas no instaladas.

También faltaban dos reglas: separar lectura de escritura, y no reconstruir serializers anidados por fila, que costaba más que serializar los datos (`lines`: ~189 ms, sus campos: ~12 ms).

## Decisión

1. **N+1 se define por comportamiento.** El número de queries de un listado no crece con sus filas, sea cual sea el camino: serializer, propiedad del modelo o cadena de managers. La prohibición de usar el ORM en serializers se mantiene.
2. **Los tests de conteo comparan y usan datos poblados.** Comparan 1 fila contra N, con cada relación que el serializer lee. Un máximo absoluto sobre filas vacías no cuenta como prueba.
3. **Se precarga solo lo que se lee.** `select_related` cubre únicamente las relaciones de las que la respuesta lee algo más que el id. Sobre 5 joins, `EXPLAIN (ANALYZE)` debe revisar también `Planning Time`.
4. **Lectura y escritura no comparten una foto de los datos.** Un queryset con valores calculados (`annotated_*`) o `Prefetch` filtrados se usa solo en respuestas (`list`, `retrieve`). Las acciones de escritura usan el queryset base.
5. **Un serializer anidado se instancia una vez por respuesta,** nunca por fila.
6. **Se permite importar selectores de otra app solo para precargar lecturas.** Se puede reutilizar un queryset o una lista de relaciones para `Prefetch`/`select_related`, con import dentro de la función. Esto modifica la regla de `backend-apps.md`. Lógica de negocio y escrituras siguen pasando por servicios, adapters o `workflow/`.
7. **Hay un solo presupuesto de backend,** en `performance.md`: p95 < 300 ms y, en queries, constante respecto de las filas (obligatorio) con revisión sobre 20 por petición.
8. **El CI bloquea un subconjunto.** Los tests con la marca `ci_gate` (invariantes y conteo de queries) bloquean; el resto de la suite sigue sin bloquear hasta resolver los fallos listados en `testing.md`. El gate no admite tests en rojo.

## Consecuencias

- Los documentos pasan a describir el estado real: Daphne en vez de Gunicorn, CI deshabilitado, herramientas no instaladas marcadas como tales.
- **El gate no tiene efecto hasta completar dos pasos manuales:** reactivar `CI Pipeline` y exigir el check en `master`. Ver [ci-cd.md](../../40-quality/ci-cd.md).
- Para dejar el gate en verde se registró deuda explícita, una entrada por caso, de modo que los casos nuevos sigan fallando:
  - `VIEW_DEBT_WHITELIST`: `sales/draft_cart_views.py:destroy` y `core/views.py:perform_update`.
  - `UNPROTECTED_BASELINE`: `treasury.BankLoan` y `treasury.ReconciliationMatch`, sin `EditPolicy`.
  - `EXEMPT_MODELS`: `workflow.CommentMention`.
  - `xfail` estricto: `complete-folio` en `features/sales/actions.tsx` y `features/purchasing/actions.tsx`.
- `ApprovalPolicyViewSet` se clasifica como master data, porque ya declaraba `pagination_class = None`.
- Los 14 tests fuera del gate (12 en SQLite más 2 solo en Postgres), incluidos los de tarjetas de tesorería, quedan en cuarentena sin corregir y requieren su propia investigación.
- Quedan fuera de esta decisión el presupuesto de payload, calcular el estado del hub en el backend y el costo del polling.

## Alternativas consideradas

- **Bloquear con toda la suite.** Exige resolver antes fallos que tocan dinero y permisos; retrasaría cualquier protección.
- **Trasladar la lectura entre apps a `adapters.py`.** Mantiene la regla anterior, pero añade una capa sin cambiar el comportamiento, solo para reenviar un queryset.
- **Excepciones por nombre de función.** `destroy` eximiría a todas las vistas homónimas, así que se usa `archivo:función`.
- **Límite duro de joins.** Depende de la query; se prefirió la regla de leer antes de unir y revisar `Planning Time`.
