# 40 — Migración y Rollback

> **Audiencia:** ingenieros que hacen merge, SREs que hacen deploy, líderes técnicos que aprueban.
> **Pregunta que responde:** ¿Cómo hacemos cada migración sin romper producción y cómo volvemos atrás si algo falla?

---

## Principios

1. **Una fase = una rama de larga duración con feature flag.** Nunca mergear todo a `master` de golpe.
2. **Compatible primero, breaking después.** Cada migración tiene una etapa intermedia donde código nuevo y viejo coexisten.
3. **Datos antes que código nuevo.** Si una refactorización requiere migración de datos, ejecutar la migración con código viejo aún corriendo, y solo después hacer cutover al código nuevo.
4. **Rollback siempre testeado en staging antes de producción.** No se aprueba un PR de migración sin demostrar que `--reverse` funciona.

---

## Feature flags

Usar `django-waffle` (o el sistema de flags ya existente — verificar antes en `settings.py`). Convención de naming:

| Flag | Habilita | Default |
|------|----------|---------|
| `arch_universal_search` | Endpoint `/api/search/` y componente `<UniversalSearch />` | `True` (low risk) |
| `arch_base_models` | Modelos transaccionales heredan de abstractas | `False` hasta validar regresión |
| `arch_strategy_totals` | `TotalsCalculationMixin` usa `TotalsStrategy` | `False` |
| `arch_strategy_dte` | `Invoice` usa `DTEStrategy` | `False` |
| `arch_document_service` | Endpoint `/api/documents/<ct>/<id>/<action>/` | `False` |
| `arch_entity_form` | `<EntityForm />` activado | `False` (per-model rollout) |
| `arch_journal_gfk` | `JournalEntry.source_document` (GFK) | `False` (riesgo alto) |

**Cómo activar progresivamente:** primero a usuarios `staff`, luego a 10%, luego 100%.

---

## Migración por fase

### F1 — Universal Registry

**Riesgo:** muy bajo. Solo se agrega código nuevo; ningún modelo cambia.

**Estrategia:**
1. Mergear todo F1 detrás de `arch_universal_search` (default `True`).
2. Si aparece error, desactivar el flag — el frontend cae al estado pre-F1 (sin búsqueda global).

**Rollback:**
- Plan A: desactivar feature flag. Pago: cero downtime.
- Plan B: revertir el commit. El módulo `core/registry.py` no afecta migrations.

---

### F2 — BaseModel abstractos

**Riesgo:** medio. Cambia herencia y agrega columnas a varias tablas.

**Estrategia paso a paso:**

#### Paso 1 — agregar abstractas vacías (sin uso)
- Mergear `core/models/abstracts.py`. Sin migrations.
- Nadie hereda aún.

#### Paso 2 — migration aditiva: timestamps faltantes
- `Account`, `JournalItem`, `BudgetItem`, `Budget`, `*Settings`, `UoM*`, `ProductCategory*`, `ProductAttribute*` reciben `created_at` y `updated_at` con `auto_now_add=True`/`auto_now=True`.
- Backfill: `created_at = now()` en todas las filas existentes (acepta pérdida de "fecha real" para datos pre-migración — se documenta).
- Esta migration es **forward-only safe**: nada se rompe si todavía no se cambió la herencia.

#### Paso 3 — cambiar herencia de un modelo (ejemplo: `SaleOrder`)
- Cambiar `class SaleOrder(models.Model, TotalsCalculationMixin)` → `class SaleOrder(TransactionalDocument, TotalsCalculationMixin)`.
- Eliminar declaraciones duplicadas de `created_at`, `updated_at`, `notes`, `total_*`, `journal_entry`, `history`.
- `python manage.py makemigrations` debe retornar **0 cambios** (los campos ya existen, solo cambia el origen de la definición).
- Si `makemigrations` propone cambios, **algo está mal** — no proceder.
- Validar: `simple_history` no genera tabla histórica duplicada.

#### Paso 4 — repetir paso 3 para cada modelo, uno por commit
- Un PR por modelo. Code review independiente.

#### Paso 5 — estandarización de `decimal_places` (si aplica)
- Si la decisión del ADR T-07 fue migrar a `decimal_places=2`:
  - Migration `ALTER TABLE` por modelo.
  - **Cuidado:** en PostgreSQL, `ALTER TABLE` con `decimal_places` aumentando es safe (no requiere bloqueo largo). Verificar con `EXPLAIN`.

**Rollback:**
- Plan A (cambio de herencia revertido): hacer `git revert` del commit. Las columnas siguen en la DB, no se borran. Sin downtime.
- Plan B (rollback de la migration de timestamps): `python manage.py migrate {app} <previous>`. **Pierde** los `created_at` recién creados, pero como son backfilled a `now()`, no hay datos reales perdidos.
- Plan C (rollback de `decimal_places`): NO trivial. Requiere otra migration que revierta. **Por eso este paso va al final** y solo cuando hay confianza.

**Validación pre-merge:**
- [ ] Snapshot de Balance, ER, Mayor, Auxiliar antes de F2.
- [ ] Mismo snapshot después produce JSON idéntico.

---

### F3 — Strategy Pattern + extracción de side-effects

**Riesgo:** medio. Sin migración de schema; refactor de código + extracción de side-effects.

**Estrategia:**

#### Paso 1 — TotalsStrategy
- Mergear `core/strategies/totals.py`.
- Detrás del flag `arch_strategy_totals` (default `False`):
  ```python
  def recalculate_totals(self):
      if waffle.switch_is_active('arch_strategy_totals'):
          return self.totals_strategy().compute(self)
      return self._legacy_recalculate_totals()  # método renombrado
  ```
- Activar flag en staging, correr suite financiera. Si OK → activar en prod.
- Cuando flag está al 100% por ≥2 semanas, eliminar `_legacy_recalculate_totals` y el flag.

#### Paso 2 — DTEStrategy
- Mismo patrón: flag `arch_strategy_dte`, fallback al código actual.

#### Paso 3 — `ContactPartnerService`
- **No usar feature flag aquí** — la lógica se extrae, no se duplica.
- Para Partners ya existentes, ejecutar comando de management:
  ```bash
  python manage.py backfill_partner_accounts --dry-run   # primero
  python manage.py backfill_partner_accounts             # después
  ```
- Validar con `Contact.objects.filter(is_partner=True, partner_contribution_account__isnull=True).count() == 0`.

**Rollback:**
- Para Strategy: desactivar feature flag, código legacy sigue funcional.
- Para `ContactPartnerService`: revertir el commit que removió la lógica de `Contact.save`. Cuentas creadas por el servicio se quedan (no son destructivas).

---

### F4 — DocumentService + Metadata Schema

**Riesgo:** medio-alto. Endpoints nuevos + frontend genérico.

**Estrategia:**

#### Paso 1 — DocumentService backend
- Implementar `DocumentRegistry` y servicios pilotos.
- Endpoint nuevo `/api/documents/<ct>/<id>/<action>/` detrás de `arch_document_service`.
- Endpoint viejo (`/api/sales/orders/<id>/confirm/`) sigue funcionando.

#### Paso 2 — Metadata Schema endpoint
- `/api/registry/<label>/schema/` activo desde el primer deploy.
- Cache 5 min.
- Si la introspección revela campos sensibles, agregarlos a `FormMeta.exclude_fields` y deplyear hotfix.

#### Paso 3 — `<EntityForm />` por modelo (rollout per-model)
- Flag `arch_entity_form` con configuración por `model_label`:
  ```python
  ENTITY_FORM_ENABLED_MODELS = {
      'accounting.budget',
      'accounting.budgetitem',
      'inventory.uom',
      # Agregar de a uno
  }
  ```
- Usuarios siguen viendo formulario clásico hasta que el modelo se agregue al set.
- Cada modelo nuevo: PR con un solo `model_label` + tests E2E.

**Rollback:**
- Per-model: remover label del set `ENTITY_FORM_ENABLED_MODELS`.
- Endpoints `/api/registry/.../schema/`: cache invalidación es Redis (TTL 5 min auto). Sin riesgo.

---

### F5 — GenericForeignKey + ProductTypeStrategy

**Riesgo:** ALTO. Requiere migración de datos en producción + ALTER TABLE en tablas grandes.

#### Pre-flight checklist (antes de empezar F5)

- [ ] Backup completo de la DB. Verificado que se puede restaurar.
- [ ] Staging actualizada con copia anonimizada de producción.
- [ ] Suite financiera + suite de regresión 100% verde sobre staging.
- [ ] Plan de rollback ejecutado en staging y cronometrado.
- [ ] Ventana de mantenimiento agendada con stakeholders.

#### Patrón general de migración GFK (aplica a T-41, T-42, T-43)

**Etapa A — Aditiva (compatible)**
1. Migration agrega columnas `source_content_type_id`, `source_object_id`, `source_document` (GFK).
2. Estas columnas son `NULL`. Nadie las usa todavía.
3. Sin downtime.

**Etapa B — Backfill**
1. Comando de management `python manage.py backfill_journal_source_documents`:
   - Recorre `Invoice`, `TreasuryMovement`, `SaleOrder`, `PurchaseOrder`, `StockMove` y popula los GFK.
   - Idempotente: corre con `--resume` si se interrumpe.
   - Logs detallados; reporte final con conteos por tipo.
2. Verificación: `JournalEntry.objects.filter(source_content_type__isnull=True, fiscal_year_closing__isnull=True, fiscal_year_opening__isnull=True).count() == 0`.

**Etapa C — Cutover de código**
1. `JournalEntry.get_source_documents` y `get_source_document` ahora leen del GFK.
2. Frontend que mostraba "documento origen" sigue funcionando — recibe el mismo shape.
3. Las relaciones inversas (`journal.invoice`, `journal.payment`, etc.) **siguen existiendo** durante esta etapa por compatibilidad. No se borran todavía.

**Etapa D — Limpieza (separada por ≥1 sprint)**
1. Después de ≥2 semanas estable en prod, otra migration elimina los `OneToOneField` legacy (`Invoice.journal_entry` con `related_name='invoice'`, etc.).
2. Antes: verificar grep que ningún código accede a esas reverse relations.

#### Performance: Benchmark GFK vs FK

GFK no soporta `select_related` cross-type. Esto puede degradar listados como "Auxiliar de Proveedores".

**Mitigación:**
- `prefetch_related('source_content_type')` reduce queries a una por tipo.
- Para la lista del Mayor, generar el queryset con `Prefetch` por content_type:
  ```python
  invoice_ct = ContentType.objects.get_for_model(Invoice)
  qs = JournalEntry.objects.prefetch_related(
      Prefetch('source_content_type'),
  )
  # Para listar: separar por tipo y hacer in_bulk()
  ```

**Métrica de éxito:** p95 de "Auxiliar de Proveedores" no degrada >20% (T-52).

#### Rollback de F5

**Si el rollback ocurre durante etapa A (aditiva):**
- `python manage.py migrate accounting <previous>` revierte la migration. Sin pérdida de datos.

**Si el rollback ocurre durante etapa B (backfill):**
- Las columnas siguen llenas, pero ningún código las usa. No hay daño.
- Si la causa es código nuevo: revertir el commit de código.
- Si la causa es datos inconsistentes: corregir y re-ejecutar el backfill.

**Si el rollback ocurre durante/después de etapa C (cutover):**
- Revertir el commit de código que migró `get_source_documents` al GFK. Las reverse relations legacy (`journal.invoice`, etc.) siguen existiendo.
- Las columnas GFK quedan llenas pero ignoradas. Sin daño.

**Si el rollback ocurre después de etapa D (legacy borrado):**
- Restaurar desde backup. **Esto es por qué la etapa D va separada por ≥1 sprint.**

---

## Riesgos Activos

> Esta sección se actualiza durante la ejecución. Cada riesgo tiene ID `R-NN`, propietario, mitigación.

| ID | Riesgo | Probabilidad | Impacto | Mitigación | Status |
|----|--------|--------------|---------|------------|--------|
| R-01 | `simple_history(inherit=True)` duplica tablas históricas | Media | Alto (pérdida de audit trail) | Validar en staging que `python manage.py migrate` no genera `historical*` duplicadas. Si pasa: usar `inherit=False` y duplicar declaración en cada subclase. | Open |
| R-02 | Cambio de `decimal_places=0 → 2` requiere casting en aggregates | Alta | Medio | Auditar `accounting/services.py`, `billing/services.py`, todos los `Sum(...)` antes del merge. | Open |
| R-03 | Introspección de `_meta` expone campos sensibles (ej: `User.pos_pin`) | Media | Crítico | `FormMeta.exclude_fields` obligatorio para `User` y `*Settings`. Test que valida que ningún schema retorna campos en allowlist de "secrets". | Open |
| R-04 | `transitions` en `FormMeta` divergen de la lógica real en views | Media | Medio | Test que valida que cada `Status` declarada tiene transitions. Linter custom que falla si hay choices sin transitions. | Open |
| R-05 | GFK degrada performance de listados de reportes | Alta | Alto | T-52 obligatorio antes de marcar F5 como completo. Si degrada >20%, agregar índices `(source_content_type_id, source_object_id)`. | Open |
| R-06 | ALTER TABLE en `Invoice` (~180k filas) bloquea producción | Media | Crítico | Ventana de mantenimiento + `pg_repack` o migration con `ADD COLUMN ... NULL` (no bloqueante). | Open |
| R-07 | El equipo subestima la complejidad de `Account` y aplica `BaseModel` allí | Media | Alto | La fase F2 explícitamente excluye `Account`. Code review obligatorio. | Open |
| R-08 | `<EntityForm />` se vuelve un god-component intentando manejar todos los casos | Alta | Medio | Política: si un modelo necesita >2 conditionals especiales, NO usar `<EntityForm />`. | Open |

---

## Checklist pre-deploy de cada fase

- [ ] CI verde en branch.
- [ ] Code review aprobado por ingeniero externo a la fase.
- [ ] Suite de regresión financiera 100% verde.
- [ ] Migration `--check --dry-run` produce 0 cambios.
- [ ] Plan de rollback documentado y probado en staging.
- [ ] Feature flag configurado correctamente.
- [ ] CHANGELOG.md actualizado.
- [ ] ADR mergeado (si aplica).
- [ ] Demo realizada al equipo.
- [ ] Stakeholder de finanzas aprueba (para F2, F3, F5).

---

## Comunicación durante deploy

- Anunciar en Slack `#engineering` 24h antes con el plan.
- Durante deploy: estado en tiempo real en `#deploys`.
- Post-deploy: validar 4 métricas dentro de los primeros 30 min:
  1. Errores 5xx no incrementaron >10%.
  2. Latencia p95 de endpoints clave (`/sales/orders/`, `/accounting/journal-entries/`) no degradó >15%.
  3. Suite de smoke tests pasa.
  4. Generación de Balance del día corriente coincide con valor esperado (ver `docs/40-quality/`).

Si alguna falla: rollback automático según plan correspondiente.

---

## Datos sensibles y compliance

Ninguna fase debe:
- Loggear `pos_pin`, `password_hash`, RUT no anonimizado.
- Exponer en schemas: campos cuyo nombre contenga `pin`, `password`, `secret`, `token`, `key`.
- Compartir backup de producción con desarrolladores sin anonimización.

Si una migración requiere acceso a estos campos: ADR específico + aprobación del DPO.
