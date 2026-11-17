# Cuadre unificado: un registro por grupo (ERP ↔ TUU ↔ RCV)

**Fecha:** 2026-11-17 · **Estado:** borrador para aprobación
**Enmienda:** ADR-0138 (D4–D6), ADR-0139 (D1–D3), ADR-0140 (D4–D5). Requiere ADR nuevo (cambia contratos de API, modelos y `status_check`).

## 1. Intención

Hoy el control de que el SII (RCV), TUU y el ERP digan lo mismo está repartido:

- vínculos por pares guardados en dos modelos (`TerminalSale.matched_invoice`, `RCVDocument.matched_invoice`, `TerminalSale.rcv_document`), cada uno con su `match_status`;
- tres servicios que se pisan (`reconcile_terminal_sales`, `reconcile_rcv_boletas`, `reconcile_rcv_period`);
- unión manual en dos fichas distintas (venta TUU en Tesorería, documento RCV en Contabilidad);
- una página por mes con botones «Recalcular RCV / TUU»;
- varios nombres para lo mismo: «Cuadre», «Cuadre fiscal», «estado de cuadre», `reconciliation`, `fiscal_match`.

**Qué se quiere:** un solo concepto, **el Cuadre**, con un solo registro por grupo, que se resuelve solo cada 10 minutos. Una página donde se revisa tanto lo cuadrado como lo pendiente, y donde se unen a mano los registros que el cruce automático no pudo unir.

## 2. Objetivos, no objetivos, anti-objetivos

**Objetivos**

1. Un nombre: **Cuadre** en la interfaz (verbo *cuadrar*, estados *Cuadrado / Pendiente / …*). En código: `fiscal_match` / `FiscalMatch`. «Conciliación» queda reservado a la conciliación bancaria.
2. Compras: cruce de 2 registros (ERP ↔ RCV).
3. Ventas: cruce de 3 registros (ERP ↔ pagos TUU ↔ RCV), con los casos:
   - pago mixto o varios pagos con tarjeta (N ventas TUU por documento);
   - factura pagada sin terminal (sin TUU: «no aplica»);
   - factura pagada con tarjeta: TUU la registra como 33 y además emite un comprobante 48 que el RCV solo trae en el resumen mensual.
4. Página sin selector de mes, con filtros; ve lo cuadrado y lo pendiente.
5. Sin botones de recálculo: la tarea Celery cada 10 minutos cubre todo lo abierto. **Nuevo:** incluye el cruce ERP ↔ RCV de facturas, que hoy solo corre al importar el RCV o con «Recalcular RCV» (la tarea actual de ADR-0140 D4 solo corre terminal → boletas → emisión).
6. Unión manual de los 3 registros desde un solo lugar (la ficha del grupo).

**No objetivos**

- Emitir DTE o cambiar la emisión automática de ADR-0140 D3 (se conserva, solo cambia de dónde lee el vínculo).
- Una venta TUU que pague varios documentos (1 venta → N documentos). No se ha visto en los datos.
- Corregir automáticamente el tipo de un documento emitido (ADR-0091 sigue).
- Cambiar la importación del RCV o la sincronización TUU.

**Anti-objetivos (sería un fracaso aunque funcione)**

- Que un vínculo automático equivocado quede como «Cuadrado» (ante duda: *Ambiguo*, nunca un vínculo).
- Que el cruce reescriba vínculos manuales.
- Que la página o la tarea hagan consultas por fila (ADR-0118).
- Que queden dos fuentes de verdad (pares antiguos + grupo).

## 3. Restricciones

- `Invoice` sigue siendo la única fuente contable (ADR-0138 D1). El grupo es evidencia, no contabilidad.
- Zero N+1, zero `any`, views ≤ 20 líneas, colecciones con `defineEntity` + `@/components/entity-view`, `StatusBadge` único renderer de estado.
- Fechas de negocio locales (America/Santiago).
- Solo cuenta desde `RCVSettings.fiscal_match_start_date`; ventana TUU `terminal_match_window_minutes` (15).
- Período con `tax_period_closed`: hoy `reconcile_rcv_period` **sí** recalcula y solo agrega un aviso a `RCVImport.warnings`. Nuevo comportamiento (§5.4): los grupos de un período cerrado se recalculan igual, pero si el estado cambia de `MATCHED` a otro, el grupo guarda `closed_period_alert` y la página lo muestra destacado.
- Permisos: lectura `tax.view_taxperiod`; acciones `tax.change_taxperiod`.

## 4. Enfoques considerados

| | Enfoque | Trade-off |
|---|---|---|
| **A (elegido)** | Modelo nuevo `FiscalMatch` por grupo: documento ERP (0..1), RCV (0..N, ver supuestos §8), ventas TUU (0..N); estado del grupo y de cada parte guardados. | Más trabajo (migración de datos, reescritura de servicios y fichas). La página filtra/cuenta/pagina una sola tabla; los 3 casos se representan sin trucos; la unión manual es una acción sobre el grupo. |
| B | Mantener pares, quitar unicidad de `TerminalSale.matched_invoice` y armar el grupo al leer. | Menos esquema, pero la lista mezcla tres fuentes con paginación frágil, el estado no está guardado (contar exige recalcular) y la unión de 3 queda en dos vínculos inconsistentes. |
| C | Vista materializada de Postgres. | Los problemas de B más el refresco. |

El usuario eligió **A**.

## 5. Diseño

### 5.1 Modelo (`tax.FiscalMatch`)

Un grupo = un documento del ERP con su evidencia externa, o un registro externo huérfano esperando su documento.

```
FiscalMatch
  direction          purchase | sale
  invoice            FK billing.Invoice, null, único cuando no es nulo
  (registros RCV: FK `RCVDocument.fiscal_match`, 0..N; ver supuestos §8)
  rcv_linked_manually bool
  status             estado del grupo (§5.2)
  erp_state          estado de la parte ERP   (§5.2)
  tuu_state          estado de la parte TUU
  rcv_state          estado de la parte RCV
  -- denormalizados para filtrar/ordenar sin joins:
  dte_type, issue_date (local), counterparty_rut, amount
  erp_amount, tuu_amount, rcv_amount
  -- emisión automática (se mueve desde TerminalSale):
  issue_attempted_at, issue_error
  fiscal_period       AAAAMM: el `period` del RCV si hay registro RCV; si no, el mes de issue_date
  closed_period_alert bool
  evaluated_at, updated_at
```

`TerminalSale` gana:

- `fiscal_match` FK → `FiscalMatch` (null, `related_name="terminal_sales"`): N ventas por grupo;
- `matched_movement` FK → `treasury.TreasuryMovement` (null, único cuando no es nulo): el pago del ERP que esa venta respalda (base del pago mixto);
- `linked_manually` bool.

Índices: `(direction, status)`, `(status, issue_date)`, `issue_date`.

**Se eliminan** (tras migrar): `TerminalSale.matched_invoice`, `match_status`, `matched_manually`, `rcv_document`, `issue_attempted_at`, `issue_error`; `RCVDocument.matched_invoice`, `match_status`, `matched_manually`.

### 5.2 Estados

Estado de **cada parte** (`PartState`):

| Valor | Etiqueta | Significado |
|---|---|---|
| `MATCHED` | Cuadrado | Presente y coincide |
| `PENDING` | Pendiente | Aún puede llegar (ventana TUU abierta, RCV del período sin importar, borrador sin folio) |
| `MISSING` | Falta | Debía estar y ya no hay excusa (ventana vencida, RCV del período importado) |
| `DIFF` | Diferencia | Presente pero monto o tipo distinto |
| `AMBIGUOUS` | Ambiguo | Varios candidatos; lo resuelve el usuario |
| `NOT_APPLICABLE` | No aplica | Ej.: TUU de una factura pagada en efectivo/transferencia; RCV de boleta de compra |
| `SUMMARY_ONLY` | Solo resumen | El SII no individualiza (RCV de un 48; 48 TUU de factura pagada con tarjeta) |

Estado del **grupo** (`FiscalMatchStatus`), derivado de las partes con esta prioridad:

1. `EXCLUDED` (Excluido): tipo sin equivalente local (43, 46, 110–112, 914), `missing_since_import`, o anterior a la fecha de inicio.
2. `AMBIGUOUS` (Ambiguo): alguna parte ambigua.
3. `DIFF` (Con diferencia): alguna parte `DIFF`.
4. `MISSING_ERP` (Falta en el ERP): hay registro externo y no documento ERP, ya vencido.
5. `MISSING_EXTERNAL` (Falta en SII/TUU): documento ERP con una parte `MISSING`.
6. `PENDING` (Pendiente): alguna parte `PENDING`.
7. `MATCHED` (Cuadrado): todas las partes en `MATCHED`, `NOT_APPLICABLE` o `SUMMARY_ONLY`.

`core/fiscal_match.py` pasa a definir `PartState` y `FiscalMatchStatus`; `MatchStatus` y `PENDING_ERP` desaparecen.

### 5.3 Reglas por caso (qué partes se esperan)

**Compras** (todas las facturas y notas de compra):

- ERP ↔ RCV por `fiscal_key` (dirección, tipo, folio, RUT), igual que hoy en `rcv.py`. Monto distinto → `DIFF`.
- TUU: siempre `NOT_APPLICABLE`.
- Boletas de compra: RCV `NOT_APPLICABLE` (no van al RCV).

**Ventas**

| Documento ERP | TUU esperado | RCV esperado |
|---|---|---|
| 39 cobrada en POS con TUU | una venta TUU por cada pago en efectivo en sesión POS de un terminal con dispositivo TUU (la porción integrada ya es un 48 aparte por `plan_sale_documents`, ADR-0138 D3) | detalle: folio (vía la venta TUU antes de emitir, ADR-0139; por folio directo una vez emitida) |
| 41 cobrada en POS con TUU | ídem 39, más los pagos integrados (el 41 no se divide); TUU dirá 48 en esos pagos → `DIFF` de tipo (regla actual de ADR-0138) | ídem 39 |
| 48 (boleta pagada con tarjeta) | ídem | `SUMMARY_ONLY` |
| 33/34 pagada con tarjeta | una venta TUU (TUU la registra como 33/34) por pago con medio integrado | detalle por folio; además su pago con tarjeta suma al **48 esperado** del resumen (§5.6) |
| 33/34 pagada sin terminal (efectivo, transferencia, crédito) | `NOT_APPLICABLE` | detalle por folio |
| 56/61 | `NOT_APPLICABLE` | detalle por folio |
| 39/41 fuera de POS (wizard, sin TUU) | `NOT_APPLICABLE` | detalle por folio |

**Pago mixto / varios pagos:** la parte TUU se cuadra **por pago**, no por total. Cada venta TUU se cruza con un `TreasuryMovement` del ERP (mismo monto del movimiento, ventana de tiempo, dispositivo/tipo de pago; reglas de `_payment_compatible` y ambigüedad de borde actuales). La parte TUU queda `MATCHED` cuando todos los movimientos que esperan TUU tienen su venta; `tuu_amount` = suma de las ventas. Esto corrige el bug actual: hoy se compara `sale_amount` contra `invoice.total` (`tax/reconciliation/terminal.py:148`).

**Tipo:** `TerminalSale.document_type` distinto del `sii_code` del documento → TUU `DIFF` (ex `TYPE_DIFF`). 33 en TUU para una factura 33 no es diferencia.

**Pendiente vs. falta:**

- TUU: `PENDING` hasta que exista una `TerminalSyncRun` exitosa del proveedor cuyo rango cubra el día del pago **y** que haya terminado después de `hora del pago + ventana`; después `MISSING`. (No basta la ventana de 15 min: la sincronización puede ser cada horas o días, ADR-0140 D6.)
- RCV: `PENDING` mientras no hay importación RCV exitosa de esa dirección para el `fiscal_period` (regla actual de `_imported_directions`); después `MISSING`. En compras, un documento ERP sin RCV pasa a `MISSING` recién cuando hay importaciones exitosas del mes de `issue_date` y de los dos siguientes (equivale a la `CANDIDATE_WINDOW` de 60 días de `rcv.py`).
- Borrador 39/41/48 sin folio: ERP `PENDING` hasta que se emite (ADR-0140).

### 5.4 Motor de cuadre (`tax/fiscal_match/`)

Reemplaza `tax/reconciliation/`. Un solo punto de entrada idempotente:

```
run_fiscal_match(scope) -> dict de conteos
```

Pasos, en una corrida:

1. **Asegurar grupos:** crear `FiscalMatch` para cada documento ERP evaluable (ventas y compras emitidas, y borradores 39/41/48 sin folio de OV) sin grupo, y un grupo huérfano por cada `RCVDocument` / `TerminalSale` sin grupo.
2. **ERP ↔ TUU por pago** (§5.3), adjuntando la venta al grupo del documento y borrando el grupo huérfano que tenía.
3. **TUU ↔ RCV boletas** (día local + monto, emparejadas en orden: ADR-0139 D1, se conserva).
4. **ERP ↔ RCV por `fiscal_key`** para facturas y notas (lógica actual de `rcv.py`).
5. **Emitir borradores** con número fiscal (ADR-0140 D3, lógica actual de `issuing.py`), y volver a correr el paso 4 para los emitidos.
6. **Derivar estados** de partes y grupo; `bulk_update`.

**Alcance (sin meses):** cada corrida evalúa, desde `fiscal_match_start_date`:

- todos los grupos que no estén en `MATCHED` / `EXCLUDED`;
- los registros nuevos o modificados desde la última corrida (`updated_at` > marca guardada en BD);
- **los grupos `MATCHED` con vínculos automáticos** cuyos pagos caen dentro del rango de la última sincronización TUU (± ventana), para que una venta TUU rival que llega tarde los reabra como `AMBIGUOUS` (hoy cada corrida limpia y recalcula el rango completo). Un vínculo del que ya salió una emisión automática (48 emitido con el id TUU) queda congelado: si aparece un rival, el grupo pasa a `AMBIGUOUS` con `closed_period_alert`, pero el vínculo no se borra;
- los grupos de períodos cerrados se recalculan igual, con `closed_period_alert` si dejan de estar cuadrados (§3).

Carga en lote por conjunto de candidatos (ADR-0118); sin consultas por fila.

**Vínculos manuales:** una venta con `linked_manually` o un grupo con `rcv_linked_manually` no se tocan, salvo que su documento se haya anulado o desaparecido (regla actual `_stale_or_automatic`).

**Tarea:** `tax.tasks.run_fiscal_match`, cada 10 minutos, con el candado en caché actual (540 s) y `soft_time_limit`. También se dispara al final de cada `TerminalSyncRun` y de cada `RCVImport` exitosa (los ganchos actuales de `treasury/tasks.py:_reconcile_after_sync` y `accounting/tasks.py:_reconcile_imported_period` pasan a encolar esta tarea en vez de llamar servicios por mes).

### 5.5 Unión manual

En la **ficha del grupo** (`FiscalMatchDrawer`, registrado en el registro de drawers como `tax.fiscalmatch`):

- **Vincular documento ERP** (grupo huérfano): candidatos del mismo tipo/dirección/RUT o monto (reutiliza `rcv_document_candidates` y `terminal_sale_candidates`, adaptados).
- **Agregar pago TUU** (grupo con documento): ventas TUU sin grupo de documento, del mismo día y con monto de algún pago del documento; el usuario elige el pago al que corresponde.
- **Vincular registro RCV**: documentos RCV del mismo tipo/RUT sin grupo de documento.
- **Quitar** cualquier vínculo: el registro vuelve a un grupo huérfano **marcado como manual** (`linked_manually` / `rcv_linked_manually` = true sin documento), para que el motor no vuelva a crear el mismo par a los 10 minutos. El grupo huérfano muestra «Devolver al cruce automático», que borra esa marca.
- **Reintentar emisión** (borradores con `issue_error`): llama a la emisión con `retry_failed=True` para ese grupo. Reemplaza el reintento que hoy hacían los botones «Recalcular» (commit 101c1d538).

Unir mueve el registro al grupo destino y borra el grupo huérfano vacío. Cada acción es un servicio `@transaction.atomic` con idempotencia (`Idempotency-Key`) y re-deriva el estado del grupo en el acto.

**Alimentación desde RCV de compras** (ADR-0138 D8, `feeding.py`): «Completar borrador» y «Registrar desde RCV» se conservan y se muestran en la ficha del grupo huérfano de compra.

### 5.6 Resumen mensual de boletas y comprobantes

Sección secundaria de la página, con su propio selector de mes (es la vista que alimenta el F29). Por tipo 39, 41, 48: ERP, TUU y resumen RCV.

**Cambio:** el **48 esperado** = comprobantes 48 del ERP **+ pagos TUU con tarjeta de facturas 33/34 del mes** (TUU emite un 48 por ese pago, y el SII lo suma a su resumen 48). Confirmado por el usuario el 2026-11-17.

### 5.7 API (`/api/tax/fiscal-matches/`)

Reemplaza `/api/tax/reconciliation/`.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/fiscal-matches/` | Lista paginada; filtros `direction`, `status`, `dte_type`, `date_from`, `date_to`, `search` (folio, RUT, monto) |
| GET | `/fiscal-matches/counts/` | Conteos por estado con los mismos filtros, y `last_run_at` |
| GET | `/fiscal-matches/{id}/` | Grupo con sus partes, ventas TUU (y el pago de cada una), registro RCV |
| GET | `/fiscal-matches/{id}/candidates/?part=erp\|tuu\|rcv` | Candidatos para la unión manual |
| POST | `/fiscal-matches/{id}/link/` | `{part, id, movement?}` |
| POST | `/fiscal-matches/{id}/unlink/` | `{part, id}` |
| GET | `/fiscal-matches/summary/?year&month` | Resumen mensual §5.6 |
| POST | `/fiscal-matches/{id}/release/` | Devolver un huérfano al cruce automático |
| POST | `/fiscal-matches/{id}/retry-issue/` | Reintentar la emisión de un borrador |
| GET | `/fiscal-matches/{id}/draft-suggestions/`, `/purchase-orders/` | Alimentación de compras (hoy `rcv_draft_suggestions`, `rcv_purchase_orders`) |
| POST | `/fiscal-matches/{id}/confirm-draft/`, `/create-draft/` | Alimentación de compras (sin cambios de lógica) |

Se eliminan `terminal/run` y `rcv/run`. `fiscal_mismatches` de `status_check` y de `calculate` del F29 mantiene su forma, pero se calcula desde `FiscalMatch` (grupos `DIFF`, `AMBIGUOUS`, `MISSING_ERP`, `MISSING_EXTERNAL` con `issue_date` en el período).

### 5.8 Interfaz

**Página Cuadre** (`/accounting/rcv/cuadre`; la ruta `reconciliation` redirige):

```
Cuadre        [Ventas | Compras] [Estado ▾] [Tipo ▾] [Fechas] [Buscar]
 ● 1.204 cuadrados  ● 37 pendientes  ● 5 con diferencia  ● 2 ambiguos   Última revisión: hace 4 min
──────────────────────────────────────────────────────────────────────────────
 Documento ERP           Pagos TUU                  RCV (SII)        Estado
 Boleta 39 · $12.500     ✓ 1 venta · 14:02          ✓ Folio 88213     Cuadrado
 Factura 33 · $80.000    ✓ 2 pagos ($50k + $30k)    ✓ Folio 1532      Cuadrado
 Factura 33 · $45.000    — no aplica                … pendiente       Pendiente
 Comprobante 48 · $9.990 ✓ 1 venta · 11:40          — solo resumen    Cuadrado
 (sin documento)         ⚠ venta TUU $7.000         ✓ Folio 88290     Falta en el ERP
```

- Los conteos son filtros rápidos. Por defecto se abre en «necesita atención» (todo menos Cuadrado/Excluido).
- Fila → `FiscalMatchDrawer` (partes, montos, vínculos, acciones manuales y de alimentación).
- Debajo: «Resumen mensual de boletas y comprobantes» (§5.6) y «Boletas pendientes de folio» (se conserva, leyendo de `FiscalMatch`).
- Sin botones de recálculo ni selector Año/Mes global.
- Banner de configuración si falta `fiscal_match_start_date` (se conserva).

**Fichas existentes** (`TerminalSaleDrawer`, `RcvDocumentDrawer`): su sección «Cuadre fiscal» con candidatos y botones se reemplaza por una fila «Cuadre» con el `StatusBadge` del grupo y un enlace que abre `FiscalMatchDrawer`.

**Listas** (RCV compras/ventas, ventas TUU): la columna/filtro `match_status` pasa a leer el estado del grupo (`fiscal_match__status`, con `select_related`).

**Compuerta F29 y checklist de cierre:** el enlace «Ir al cuadre» apunta a la página nueva con filtros del período.

## 6. Inventario: eliminar, mejorar, reutilizar

### Backend

| Elemento | Acción | Nota |
|---|---|---|
| `core/fiscal_match.py` (`MatchStatus`) | **Mejorar** | Pasa a `PartState` + `FiscalMatchStatus`; se va `PENDING_ERP` |
| `tax/reconciliation/terminal.py` | **Reutilizar + mejorar** | `_payment_compatible`, `_border_competitors`, `_terminals_by_device`, `_candidate_movements` se reutilizan; `_candidates` cambia a monto **del movimiento**; `_assign` se reescribe para grupos y N ventas |
| `tax/reconciliation/boletas.py` | **Reutilizar** | `_pair` (orden por hora/folio) y `months_in_range`; `_assign`, `propagate_invoice`, `_paired_status` se **eliminan** (los absorbe la derivación de estados) |
| `tax/reconciliation/rcv.py` | **Reutilizar + mejorar** | `_candidates_by_key`, `rut_body`, `_rcv_family`, `_warn_closed_period`, `rcv_document_candidates`; `reconcile_rcv_period` por mes se reemplaza por el paso 4 sin meses; `match_/unmatch_rcv_document` → servicio `link/unlink` del grupo |
| `tax/reconciliation/issuing.py` | **Reutilizar** | `fiscal_number_and_date`, `_issue`, `_tuu_number`, reintento; `_linked_drafts` lee de `FiscalMatch`; los campos `issue_*` se mueven al grupo |
| `tax/reconciliation/feeding.py` | **Reutilizar** | Sin cambio de lógica; vincula vía grupo |
| `tax/reconciliation/report.py` | **Mejorar** | `_summaries`, `_rcv_totals`, `_summary_row` → resumen mensual con 48 ajustado; `_pending_issue` lee del grupo; `_only_erp_documents`, `_documents`, `_terminal`, `_terminal_only_erp`, `_unpaired_boletas` **se eliminan** (ahora son conteos de `FiscalMatch`); `fiscal_mismatch_counts` se reescribe sobre `FiscalMatch` |
| `tax/reconciliation_views.py` + `reconciliation_serializers.py` | **Eliminar** | Reemplazados por `FiscalMatchViewSet` y sus serializers |
| `tax/urls.py` `reconciliation` | **Mejorar** | Registrar `fiscal-matches` |
| `tax/tasks.py` `run_fiscal_reconciliation`, `months_to_reconcile`, `_reconcile_month` | **Mejorar** | → `run_fiscal_match` sin meses; candado y `_step` se reutilizan |
| `config/settings.py` beat `run_fiscal_reconciliation_10min` | **Mejorar** | Apunta a la tarea nueva |
| `treasury/tasks.py` `_reconcile_after_sync` | **Mejorar** | Encola `run_fiscal_match` |
| `accounting/tasks.py` `_reconcile_imported_period` | **Mejorar** | Encola `run_fiscal_match` |
| `TerminalSale`: `matched_invoice`, `match_status`, `matched_manually`, `rcv_document`, `issue_*` | **Eliminar** (tras migrar datos) | Ganan `fiscal_match`, `matched_movement`, `linked_manually` |
| `RCVDocument`: `matched_invoice`, `match_status`, `matched_manually` | **Eliminar** (tras migrar datos) | Ahora es el `OneToOne` desde `FiscalMatch` |
| `accounting/selectors.py` `with_terminal_sale`, filtro `match_status`, `select_related("matched_invoice")` (l. 209 y 242) | **Mejorar** | Filtran por `fiscal_match__status`; `select_related("fiscal_match__invoice")` |
| `accounting/rcv_serializers.py`, `treasury/serializers.py` (campos de match) | **Mejorar** | Exponen `fiscal_match` (id, status, display) |
| `treasury/selectors.py:1338` | **Mejorar** | `select_related("fiscal_match")` |
| `tax/services.py` (`fiscal_mismatches` en `status_check` y `calculate`) | **Reutilizar** | Misma forma, nueva fuente |
| `RCVSettings.fiscal_match_start_date`, `terminal_match_window_minutes` y su pantalla | **Reutilizar** | |
| `backend/scripts/debug_match.py` | **Eliminar** | Script de depuración del esquema viejo (revisar antes) |
| Tests `tax/tests/test_reconcile_*`, `test_reconciliation_*`, `test_fiscal_reconciliation_task`, `test_issue_fiscal_drafts`, `test_rcv_feeding`, `test_checkout_to_terminal_match`, `reconciliation_helpers`; `treasury/tests/test_terminal_sale_match_fields` | **Mejorar** | Se reescriben sobre `FiscalMatch`; los escenarios (ambigüedad de borde, orden por folio, manual protegido, período cerrado) se conservan como casos |

### Frontend

| Elemento | Acción | Nota |
|---|---|---|
| `lib/fiscal-match.ts` | **Mejorar** | Tipos y etiquetas de `PartState` / `FiscalMatchStatus`; `FISCAL_RECONCILIATION_KEY` → `FISCAL_MATCH_KEY` |
| `features/tax/components/FiscalReconciliationClientView.tsx` | **Eliminar** | → `FiscalMatchClientView` (lista + conteos + resumen + pendientes de folio) |
| `features/tax/entity-view/fiscalReconciliation.entity.ts` | **Mejorar** | `reconciliationSummaryEntity` y `pendingIssueDocumentEntity` se reutilizan; `onlyErpDocumentEntity` se elimina; nueva `fiscalMatchEntity` (valor de parte como feature value kind) |
| `features/tax/api/reconciliationApi.ts`, `types/reconciliation.ts` | **Eliminar** | → `fiscalMatchApi.ts`, `types/fiscalMatch.ts` (Zod) |
| `features/tax/hooks/useFiscalReconciliation.ts` (`useRunReconciliation`), `useRcvMatch.ts`, `reconciliationKeys.ts` | **Eliminar** | → `useFiscalMatches`, `useFiscalMatch`, `useFiscalMatchCandidates`, `useLinkFiscalMatch`, `useUnlinkFiscalMatch` |
| `features/tax/hooks/useRcvFeeding.ts` | **Reutilizar** | Apunta a las rutas nuevas |
| `features/treasury/hooks/useTerminalSaleMatch.ts` | **Eliminar** | La unión pasa a la ficha del grupo |
| `TerminalSaleDrawer.tsx`, `RcvDocumentDrawer.tsx` (sección de cuadre) | **Mejorar** | Fila «Cuadre» + enlace a `FiscalMatchDrawer`; `RcvRegisterSection` se mueve a la ficha del grupo |
| `terminalSale.entity.ts`, `rcvDocument.entity.ts`, `RcvDocumentsClientView`, `TerminalSalesClientView`, `accounting/unifiedSearchDef.ts` | **Mejorar** | Columna/filtro del estado del grupo |
| `lib/entity-drawers.tsx`, `lib/entity-registry.ts` | **Mejorar** | Registrar `tax.fiscalmatch` |
| `features/accounting/navigation.ts` (subpestaña «Cuadre») y `app/(dashboard)/accounting/rcv/reconciliation/page.tsx` | **Mejorar** | Ruta `cuadre`, título «Cuadre», redirección desde `reconciliation` |
| `DeclarationWizard.tsx`, `AccountingPeriodCloseChecklist.tsx` («Ir al cuadre») | **Mejorar** | Enlace nuevo con filtros del período |
| Tests afectados (`FiscalReconciliationClientView.test`, `RcvDocumentDrawer.test`, `TerminalSaleDrawer.test`, `TerminalSalesClientView.test`, `RcvDocumentsClientView.test`, `fiscal-match.test`, `rcvUnifiedSearchDef.test`, `DeclarationWizard.test`, `AccountingPeriodCloseChecklist.test`) | **Mejorar** | |

### Textos y documentación

| Elemento | Acción |
|---|---|
| Textos «Cuadre fiscal», «estado de cuadre», «reconciliación» en UI fiscal | Unificar a «Cuadre» |
| Docstrings y comentarios del backend fiscal («reconciliación», «cuadre fiscal») | Unificar a «cuadre» |
| ADR nuevo (0141) que enmienda 0138 D4–D6, 0139 D1–D3, 0140 D4–D5 | Crear |
| `docs/20-contracts/api-contracts.md` | Actualizar rutas |
| `docs/00-context` glosario | Agregar «Cuadre» y «grupo de cuadre» |

## 7. Migración de datos

Una migración de datos (reversible hasta el paso de eliminación de campos, que va en una migración posterior):

1. Un `FiscalMatch` por cada `Invoice` con `TerminalSale.matched_invoice` o `RCVDocument.matched_invoice`; adjuntar esas ventas y ese documento RCV, conservando `matched_manually` → `linked_manually` / `rcv_linked_manually`.
2. Para cada venta adjunta, `matched_movement` = el movimiento del documento con el mismo monto (si hay uno solo; si no, nulo y el motor lo resuelve).
3. Boletas RCV con venta TUU pero sin documento (`PENDING_ERP`): grupo huérfano con ambos registros.
4. Resto: sin grupo; la primera corrida del motor los crea.
5. Copiar `issue_attempted_at`/`issue_error` al grupo.
6. Correr `run_fiscal_match` una vez tras desplegar.

## 8. Decisiones del builder (mis llamadas, revisables)

- Nombre en código `fiscal_match` / `FiscalMatch`; ruta `/accounting/rcv/cuadre` con redirección. *(propuesta)*
- La página abre por defecto en «necesita atención». *(propuesta)*
- La marca de «última corrida» se guarda en BD (no solo caché) para que la página muestre «Última revisión». *(propuesta)*
- `FiscalMatch` vive en la app `tax` (ya depende de `billing`, `accounting` y `treasury`). *(propuesta)*

### Supuestos tras la revisión (el usuario aprobó sin responderlos; reglas válidas para cualquier respuesta)

- **¿Una boleta por venta TUU o una por venta completa?** Desconocido. El vínculo RCV se modela como FK desde `RCVDocument.fiscal_match` (N registros RCV por grupo, en vez de OneToOne). La parte RCV de una boleta cuadra si sus registros RCV suman el monto esperado (abajo). La emisión automática de un 39/41 solo ocurre con **un único** registro RCV; con varios, la parte RCV queda `MATCHED` si suma bien, pero el borrador **no** se emite solo: la parte ERP queda `PENDING` con el aviso «varios folios en el SII» y la ficha lista todos los folios. *(Revisar con datos reales.)*
- **Boleta 39 con efectivo + medio sin TUU:** la parte RCV de una boleta cuadra si la suma RCV es igual al **total del ERP** o a la **suma de sus ventas TUU**; cualquier otro monto es `DIFF`.
- **Compuerta F29:** `fiscal_mismatches` sigue en **Sugeridos** (no bloquea). Cuenta grupos `DIFF`, `AMBIGUOUS`, `MISSING_ERP` y `MISSING_EXTERNAL` del `fiscal_period`; `by_status` usa las claves nuevas y el frontend que lo lee (wizard F29, checklist de cierre) se actualiza.

## 9. Queda para el builder

- Forma exacta de los serializers y del value kind de «parte» en `entity-view`.
- Orden de las migraciones y si los campos viejos se eliminan en el mismo release o en el siguiente.
- Estrategia de lotes del motor si el volumen desde `fiscal_match_start_date` crece (paginación por `issue_date`).
