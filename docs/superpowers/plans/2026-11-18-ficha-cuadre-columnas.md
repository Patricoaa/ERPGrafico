# Ficha de cuadre en columnas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `FiscalMatchDrawer` en una mesa de cuadre de columnas (ERP → TUU → RCV; compras ERP → RCV), con candidatos «sin cuadrar» ordenados por coincidencia, cambios en espera y un único «Guardar cambios» atómico que aplica las reglas del cuadre en el servidor.

**Architecture:** Backend: `tax/fiscal_match/scoring.py` (puntaje y advertencias, puro), `search` (candidatos paginados por parte) y `apply` (`apply_changes` atómico bajo el candado del motor, reutilizando los servicios de unión endurecidos). Frontend: hooks `useFiscalMatchSearch` (infinite) y `useApplyFiscalMatch`, un hook de borrador puro `useFiscalMatchDraft`, y la ficha reescrita con `FiscalMatchColumn` y `FiscalMatchCandidateCard` y el pie `FormFooter`.

**Tech Stack:** Django 5 + DRF; Next.js 16, TanStack Query (`useInfiniteQuery`), entity-view y shared components.

**Spec:** `docs/superpowers/specs/2026-11-18-ficha-cuadre-columnas-design.md` (leer completo, incluidas §7b y §7c). Base: ADR-0141.

## Global Constraints

- Término «Cuadre». Etiquetas nuevas: grupo `DIFF` = **«Con advertencias»**; parte `DIFF` = **«Advertencia»**. El resto de etiquetas no cambia.
- Puntaje 0–100: monto igual 40; mismo día local 25, si no `max(0, 15 − 3 × días)`; mismo RUT normalizado 20 (o 20 si la parte no tiene RUT: TUU, boletas 39/41); tipo compatible 15; folio igual con la misma dirección y el mismo tipo = 100.
- Intents del chip de coincidencia: ≥ 90 success, 60–89 warning, < 60 neutral.
- **Bloquean** el guardado (400, `{detail, code, change_index}`): `TYPE_INCOMPATIBLE` (incluye el efectivo TUU hacia algo que no es 39/41), `OTHER_DIRECTION`, `PAYMENT_TAKEN`, `SECOND_DOCUMENT`, `SECOND_RCV`, `NOT_COMPLETED`, `MOVED`, `PAYMENT_REQUIRED`, `NOT_ALLOWED` (quitar el documento ERP).
- **Advierten** (no bloquean): `OTHER_RUT` (facturas y notas), `OTHER_DAY`, `OTHER_AMOUNT`. Tras guardar, el estado es `DIFF` por monto (regla actual) y por RUT (nuevo, en facturas y notas); otro día no cambia el estado.
- Universo ERP: documentos de los últimos 62 días (`SCAN_DAYS`); con `q`, sin límite de fecha. Las ventas anuladas no se ofrecen.
- Candado del motor (409 con el mensaje actual), `Idempotency-Key`, permisos `tax.view_taxperiod` (leer) y `tax.change_taxperiod` (guardar).
- Ancho de la ficha: `formDrawerWidth("master")` (75 %).
- Repo: zero `any`, zero N+1 (consultas fijas por página), views ≤ 20 líneas, `StatusBadge`, barrels, hooks de feature, sin colores crudos.
- Comandos: backend `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`; frontend `cd frontend && export PATH=/home/pato/.nvm/versions/node/v24.18.0/bin:$PATH && npx vitest run --project '!storybook' <ruta>`; `npm run type-check && npm run lint`.

## Review Focus

1. **Guardado con un cambio que falla a la mitad** → no se aplica ningún cambio; la respuesta indica `change_index`. (Task 3)
2. **Un huérfano con 2 ventas TUU propias elige un documento con 2 pagos del mismo monto** → requiere el mapa `payments` y asigna cada venta a su pago; sin mapa, `PAYMENT_REQUIRED`. (Task 3)
3. **El motor se ejecuta entre la carga de la ficha y el guardado y mueve un registro** → `MOVED` con su índice; el borrador descarta ese cambio con un aviso al refrescar. (Tasks 3 y 8)
4. **Venta TUU en efectivo seleccionada para una factura** → la tarjeta aparece deshabilitada con «Efectivo solo en boletas»; si igual se envía, el servidor responde `TYPE_INCOMPATIBLE`. (Tasks 2, 5 y 9)
5. **Cerrar la ficha con cambios en espera** → se pide confirmación y no se pierden los cambios sin aviso. (Task 9)

---

## Task 1: Etiquetas «Con advertencias» y RUT distinto como DIFF

**Files:** Modify `backend/core/fiscal_match.py`, migración de choices si `makemigrations` la exige (`tax`, `treasury`, `accounting`), `backend/tax/fiscal_match/states.py` (`_rcv_state`), `frontend/lib/fiscal-match.ts`, `docs/00-context/domain-glossary.md`. Tests: `backend/core/tests/test_fiscal_match_states.py`, `backend/tax/tests/fiscal_match/test_states.py`, `frontend/lib/__tests__/fiscal-match.test.ts`.

**Interfaces:** Produces: etiquetas nuevas. `_rcv_state` devuelve `DIFF` en facturas y notas (33/34/56/61) cuando el RUT normalizado del RCV difiere de `group.counterparty_rut` (o del RUT del documento).

- [ ] Tests: las etiquetas `FiscalMatchStatus.DIFF.label == "Con advertencias"` y `PartState.DIFF.label == "Advertencia"`; `test_invoice_rcv_with_other_rut_is_diff`; `test_boleta_rcv_rut_ignored`; el test de etiquetas del frontend.
- [ ] Ver fallar, implementar, ver pasar; `makemigrations --check`.
- [ ] Commit `feat(tax): «Con advertencias» y el RUT distinto queda como advertencia del cuadre`

## Task 2: Validaciones bloqueantes en las uniones manuales

**Files:** Modify `backend/tax/fiscal_match/services.py`. Test `backend/tax/tests/fiscal_match/test_services.py`.

**Interfaces:** Produces: constantes de código de error (`TYPE_INCOMPATIBLE`, `OTHER_DIRECTION`, `PAYMENT_TAKEN`, `SECOND_DOCUMENT`, `SECOND_RCV`, `NOT_COMPLETED`, `MOVED`, `PAYMENT_REQUIRED`) y `class FiscalMatchRuleError(ValidationError)` con un atributo `code`. Las reglas viven en funciones `_check_*` reutilizadas por `link_invoice`, `link_terminal_sale` y `link_rcv_document`:
- **Venta TUU ↔ documento:** usa `candidates.payment_compatible` (efectivo solo con 39/41) y la regla de tipo de `states` (el `document_type` de TUU frente al `sii_code`, con 33 en TUU válido para una factura 33). Además, el pago debe estar libre y la venta `COMPLETED`.
- **RCV ↔ documento:** misma dirección y mismo tipo. En facturas y notas, un solo RCV por grupo. El RUT distinto **ya no bloquea** (hoy `_check_rcv` lo rechaza: quitarlo).
- **Documento ERP:** un huérfano solo puede unirse a un documento cuyo grupo no tenga ya registros de la parte que el huérfano trae en facturas y notas (`SECOND_RCV`). En boletas se acumulan.

- [ ] Tests: uno por código bloqueante, más `test_other_rut_invoice_links_and_group_is_diff` (se permite y queda `DIFF`).
- [ ] Ver fallar, implementar, ver pasar (`pytest tax -q`).
- [ ] Commit `fix(tax): la unión manual aplica las reglas del cuadre en el servidor`

## Task 3: `apply_changes` atómico

**Files:** Modify `backend/tax/fiscal_match/services.py`. Test `backend/tax/tests/fiscal_match/test_apply.py`.

**Interfaces:**
- **Consumes:** Task 2.
- **Produces:**
  - `Change = TypedDict(op: Literal["link","unlink"], part: Literal["erp","tuu","rcv"], id: int, movement: int | None, payments: dict[int, int] | None)`.
  - `apply_changes(group: FiscalMatch, changes: list[Change]) -> FiscalMatch` bajo `_exclusive` + `@transaction.atomic`.
  - **Orden:** primero los `unlink`, luego `link erp`, después `link tuu` y `link rcv` sobre el grupo resultante.
  - **Variantes internas:** las funciones públicas actuales pasan a envolver variantes `_link_invoice` / `_link_terminal_sale` / `_link_rcv_document` / `_unlink`, que no toman candado ni transacción y no re-derivan. `apply_changes` re-deriva y estampa una vez, al final.
  - **Bloqueo:** bloquea al inicio todos los grupos involucrados (en orden de pk) y re-lee cada registro con `select_for_update`. Un registro que ya no está donde se esperaba da `MOVED`.
  - **Errores:** cualquier `FiscalMatchRuleError` en el cambio *i* se re-lanza con `change_index=i` y revierte todo.
  - **`unlink erp`:** se rechaza con el código `NOT_ALLOWED` y el mensaje «El documento ERP no se quita del cuadre».
  - **`link erp`:** acepta `payments` (`{sale_id: movement_id}`) para las ventas propias del huérfano. `_assign_payments` usa el mapa y, sin mapa, conserva el comportamiento actual (pago único automático, si no `PAYMENT_REQUIRED`).
  - **Respuesta:** devuelve el grupo resultante.

- [ ] Tests:
  - `test_apply_links_erp_tuu_rcv_in_one_call`
  - `test_apply_rolls_back_all_when_one_fails` (Review Focus 1, con `change_index`)
  - `test_apply_orphan_two_sales_payment_map` (Review Focus 2)
  - `test_apply_moved_record_reports_index` (Review Focus 3)
  - `test_apply_unlink_erp_not_allowed`
  - `test_apply_busy_engine_409`
  - `test_apply_query_count_bounded` (la cantidad de consultas no crece con N cambios iguales salvo las propias de cada unión; usar 2 frente a 4 cambios y documentar el delta por cambio en el test)
- [ ] Ver fallar, implementar, ver pasar.
- [ ] Commit `feat(tax): guardado atómico de los cambios del cuadre`

## Task 4: Endpoint `apply` y retiro de `link` / `unlink` / `candidates`

**Files:** Modify `backend/tax/fiscal_match/views.py`, `serializers.py` (agregar `ApplySerializer`; eliminar `LinkSerializer`, `UnlinkSerializer`, `CandidatesQuerySerializer` y los serializers de candidatos que no reutilice Task 6), `services.py` (eliminar `link`, `group_candidates` y los `_*_candidates` que Task 6 no reutilice; **conservar** la lógica de compatibilidad que Task 6 necesite, moviéndola a `candidates.py` si hace falta). Tests: `test_api.py`; eliminar los tests de los endpoints retirados.

**Interfaces:** `POST /api/tax/fiscal-matches/{id}/apply/` con `@idempotent_endpoint(scope="tax.fiscal_match.apply")` y permiso `tax.change_taxperiod`. Cuerpo `{changes: Change[]}` (máximo 50). Responde 200 con el detalle del grupo resultante; 400 `{detail, code, change_index}`; 409 si el motor está ocupado.

- [ ] Tests: `test_apply_endpoint_ok`, `test_apply_endpoint_error_shape`, `test_apply_permissions`, `test_apply_idempotent_replay`, `test_removed_endpoints_404`.
- [ ] Commit `feat(tax): endpoint de guardado del cuadre y retiro de las uniones sueltas`

## Task 5: Puntaje y advertencias (puro)

**Files:** Create `backend/tax/fiscal_match/scoring.py`. Test `backend/tax/tests/fiscal_match/test_scoring.py`.

**Interfaces:**
- `@dataclass(frozen=True) Reference(direction, sii_code: int | None, date: date | None, rut: str, amount: Decimal | None, free_payment_amounts: frozenset[Decimal], folio: int | None)`.
- `reference_for(group, ctx) -> Reference`. La referencia es el documento; en un huérfano, su primera venta TUU y si no su primer RCV. Lo de §7b.
- `@dataclass(frozen=True) Warning(code: str, label: str, blocking: bool)`.
- `score_candidate(ref: Reference, cand: CandidateFacts) -> tuple[int, list[Warning]]` con los pesos de Global Constraints. `CandidateFacts(kind: Literal["erp","tuu","rcv"], direction, sii_code, date, rut: str | None, amount, folio, payment_type, status)`.
- **Etiquetas de advertencia:**
  - «Otro monto»;
  - «Otro día»;
  - «Otro RUT»;
  - «Tipo distinto» (bloquea);
  - «Efectivo solo en boletas» (bloquea);
  - «Otra dirección» (bloquea);
  - «Venta anulada» (bloquea).

- [ ] Tests: casos de tabla para cada criterio y cada combinación de bloqueo, incluido el folio = 100 solo con la misma dirección y el mismo tipo.
- [ ] Commit `feat(tax): puntaje de coincidencia del cuadre`

## Task 6: Endpoint `search`

**Files:** Create `backend/tax/fiscal_match/search.py`. Modify `views.py`, `serializers.py`. Test `backend/tax/tests/fiscal_match/test_search.py`.

**Interfaces:**
- **Endpoint:** `GET /fiscal-matches/{id}/search/?part=erp|tuu|rcv&q=&ordering=score|recent&page=`, con `StandardResultsSetPagination` (20) y permiso `tax.view_taxperiod`.
- **Universos de §5.2.** Si el grupo no tiene documento, `tuu` y `rcv` devuelven solo sus propios registros (sin candidatos).
- **Orden:** con `ordering=score`, el queryset anota en SQL un puntaje aproximado con la misma ponderación (monto igual, distancia de días, RUT igual) y ordena por él. El puntaje final y las advertencias de cada fila de la página salen de `score_candidate`; si difieren, prevalece el de Python (el SQL solo ordena).
- **Item:**
  - `{id, kind, label, counterparty, date, datetime?, amount, score, warnings[], compatible_movements?}`;
  - en TUU, `compatible_movements` = los pagos libres del documento con el monto de la venta (como hoy);
  - en ERP sobre un huérfano con ventas, los pagos libres por venta: `payments_by_sale: {sale_id: CandidateMovement[]}`.

- [ ] Tests:
  - universo por parte (no ofrece grupos cuadrados ni ventas anuladas);
  - `q` por folio, RUT, monto y nombre;
  - orden por puntaje;
  - límite de 62 días sin `q`;
  - consultas constantes con 3 y con 25 filas;
  - advertencia bloqueante presente en el efectivo hacia una factura.
- [ ] Commit `feat(tax): búsqueda de candidatos del cuadre con puntaje`

## Task 7: Cliente frontend

**Files:** Modify `frontend/features/tax/types/fiscalMatch.ts`, `api/fiscalMatchApi.ts`, `hooks/useFiscalMatches.ts`, `hooks/fiscalMatchKeys.ts`, barrels. Test `hooks/__tests__/useFiscalMatches.test.tsx`, `api/__tests__/fiscalMatchApi.test.ts`.

**Interfaces:**
- **Tipos:** `FiscalMatchChange`, `FiscalMatchSearchItem`, `FiscalMatchWarning`, `FiscalMatchApplyError {detail, code, change_index}`.
- **API:** `fiscalMatchApi.search(id, part, {q, ordering}, page)` y `fiscalMatchApi.apply(id, changes, key)`.
- **Hooks:**
  - `useFiscalMatchSearch(id, part, {q, ordering}, enabled)` con `useInfiniteQuery` (siguiente página desde `next`), que devuelve `{ items, totalCount, fetchNextPage, hasNextPage, isLoading, isError, refetch }`;
  - `useApplyFiscalMatch()` sobre `useGroupMutation`: sigue al grupo resultante e invalida.
- **Se eliminan:** `useFiscalMatchCandidates`, `useLinkFiscalMatch`, `useUnlinkFiscalMatch`, `fiscalMatchApi.candidates/link/unlink` y sus tipos.

- [ ] Tests: los parámetros de búsqueda, la paginación infinita, el cuerpo de `apply` con `Idempotency-Key` y el error 400 con `change_index` propagado.
- [ ] Commit `feat(tax): cliente de búsqueda y guardado del cuadre`

## Task 8: `useFiscalMatchDraft`

**Files:** Create `frontend/features/tax/hooks/useFiscalMatchDraft.ts`. Test `hooks/__tests__/useFiscalMatchDraft.test.tsx`.

**Interfaces:** `useFiscalMatchDraft(group: FiscalMatchDetail | undefined)` devuelve:
- `pending: FiscalMatchChange[]`;
- `select(part, item, movement?)`;
- `unselect(part, id)`;
- `remove(part, id)` para quitar uno ya unido;
- `setPayment(saleId, movementId)`;
- `discard()`;
- `isDirty`;
- `stateOf(part, id)`, que da `'linked' | 'toRemove' | 'selected' | 'error' | 'idle'`;
- `consequences: string[]`, como «La boleta SII folio N se moverá también»;
- `markError(index, message)`;
- `reconcile(group, visibleIds)`, que descarta los cambios cuyo registro ya no está disponible y devuelve los avisos.

**Reglas:** en ERP, uno solo y solo si el grupo es huérfano; en TUU, varios y cada uno con su pago; en RCV, varios en boletas y uno en facturas y notas. Al seleccionar, reemplaza la selección previa cuando el máximo es 1.

- [ ] Tests: cada regla de selección, el cuerpo producido, la reconciliación y el marcado de error.
- [ ] Commit `feat(tax): borrador de cambios del cuadre`

## Task 9: Ficha en columnas

**Files:**
- Rewrite `frontend/features/tax/components/FiscalMatchDrawer.tsx`.
- Create `FiscalMatchColumn.tsx`, `FiscalMatchCandidateCard.tsx`.
- Keep `FiscalMatchRegisterSection` (bajo la columna RCV de un huérfano de compra).
- Tests `components/__tests__/FiscalMatchDrawer.test.tsx` (reescribir), `FiscalMatchCandidateCard.test.tsx`.

**Interfaces:**
- Consumes Tasks 7–8 y §5.1 del spec.
- **Antes de codificar, leer:** `DESIGN.md`, `docs/20-contracts/component-card-family.md`, `component-entity-drawers.md`, `component-decision-tree.md` y `frontend/app/globals.css`.
- **Ficha:** ancho `master`. Muestra el encabezado y los avisos actuales, con «Reintentar emisión» y «Devolver al cruce automático» como acciones inmediatas.
- **Columnas:** son 2 en compras y 3 en ventas, con numeración «01/02/03» y flechas. En cada columna:
  - arriba, «En este cuadre»;
  - abajo, «Sin cuadrar», con buscador (debounce de 300 ms), «N resultados», un selector de orden y scroll infinito;
  - la parte en «No aplica» o «Solo resumen» muestra un mensaje en lugar de la lista.
- **Tarjeta:** muestra la etiqueta, la contraparte o el dispositivo, la fecha, el total, el chip de coincidencia y los chips de advertencia. Si alguna advertencia bloquea, la tarjeta queda deshabilitada con su motivo. En TUU incluye el selector de pago.
- **Pie (`FormFooter`):** muestra «N cambios sin guardar», las consecuencias, y los botones «Descartar» y «Guardar cambios».
- **Errores al guardar:**
  - 400 → se marca la tarjeta del `change_index`;
  - 409 → aviso y el borrador se conserva.
- **Cierre con cambios:** se pide confirmación con `ActionConfirmModal` («Hay cambios sin guardar»).
- **Solo lectura:** sin `tax.change_taxperiod` no hay selección ni pie.

- [ ] Tests:
  - render de compras (2 columnas) y de ventas (3);
  - seleccionar y guardar envía el cuerpo correcto;
  - tarjeta bloqueante deshabilitada (Review Focus 4);
  - error 400 marca la tarjeta;
  - 409 conserva el borrador;
  - confirmación al cerrar (Review Focus 5);
  - solo lectura sin permiso;
  - el huérfano sigue al grupo resultante tras guardar.
- [ ] `npm run type-check && npm run lint` y vitest de `features/tax`.
- [ ] Commit `feat(tax): ficha de cuadre en columnas con guardado único`

## Task 10: Documentación

**Files:** `docs/10-architecture/adr/0141-*.md` (enmendar D7/D8: el guardado atómico, `search`, el puntaje, las reglas bloqueantes y las advertencias, «Con advertencias»), `docs/20-contracts/api-contracts.md` (`search`, `apply`; retirar `link`, `unlink` y `candidates`), `docs/20-contracts/idempotency.md` (scope `tax.fiscal_match.apply`; retirar `link` y `unlink`), `docs/00-context/domain-glossary.md` (etiquetas).

- [ ] `grep -rn "Con diferencia\|/link/\|/unlink/\|/candidates/" docs frontend backend --include=*.md --include=*.ts --include=*.tsx --include=*.py | grep -v superpowers` → solo menciones históricas.
- [ ] Commit `docs: ADR-0141 con la ficha de cuadre en columnas`
