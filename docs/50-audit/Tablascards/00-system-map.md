# 00 · Mapa del sistema y delta (Fase 0)

> Fecha: 2026-10-16 · Rama: `feat/document-system` · Sin cambios de código.
> Todas las cifras se miden desde `frontend/` y excluyen `node_modules`, `.next`, `__tests__`, `*.test.*` y `*.stories.*`, salvo que se indique otra cosa.
> Leyenda de evidencia: **V** = Verificado · **P** = Probable · **Pd** = Pendiente · **DP** = Decisión propuesta.

## 1. Delta frente al §2 del prompt

| Métrica | §2 (orientativo) | Medido | Estado | Comando / evidencia |
|---|---|---|---|---|
| Props de `DataTableProps` | 56 | **57** | V (cambia) | `awk 'NR>=37&&NR<=144' components/shared/DataTable.tsx \| grep -cE "^    [a-zA-Z]+\??:"` |
| Líneas de `DataTable.tsx` | ~1000 | 1001 | V | `wc -l` |
| Miembros de `FieldType` | 10 | **15** (`text, code, date, dateTime, currency, status, number, secondary, contact, chip, chip-category, currencyFlow, numericFlow, sourceDest, computed`) | V (cambia) | `entity-fields.tsx:14-29` |
| Líneas de `entity-fields.tsx` | ~1200 | 1195 | V | `wc -l` |
| Miembros de `DataCell` | 23 | 23 | V | `awk 'NR>=104&&NR<=756' components/shared/DataTableCells.tsx \| grep -cE "^    [A-Z][A-Za-z]+:"` |
| Miembros de `DataCell` alcanzables desde `*Fields.ts` | "varios no" | **13 de 23**. No alcanzables: `Entity, Link, Variance, Progress, Icon, Action, ActionGroup, ActionSingle, ActionMenu, WorkflowSummary` | V | `grep -oE "DataCell\.[A-Z][A-Za-z]+" components/shared/entity-fields.tsx \| sort -u` |
| Factories `create*Column` | — | 9 (`Actions, HubTrigger, Code, Date, Currency, Secondary, Contact, Status, Expander`). Las de valor (`Code…Status`) tienen **1 uso cada una**; `Actions` 9, `Expander` 7, `HubTrigger` 5 | V | `grep -rnoE "create(…)Column\b" app features components` |
| Líneas de `AutoEntityCard.tsx` / `EntityCard.tsx` | ~470 / ~700 | 469 / 696 | V | `wc -l` |
| Props de `AutoEntityCard` | — | 22 | V | `AutoEntityCard.tsx:13-95` |
| Subcomponentes de `EntityCard` | — | 12 (`Header, Body, Field, Footer, Badge, Skeleton, ListItem, ListItemSkeleton, WorkflowBody, Metrics, Dashboard, HubTrigger`) | V | `EntityCard.tsx:665-678` |
| Archivos que usan `<AutoEntityCard` | 47 | **47** | V | `grep -rlE "<AutoEntityCard" app features components \| grep -v components/shared \| wc -l` |
| Archivos con `toColumns(` | 57 | **62** (74 llamadas) | V (cambia) | `grep -rlE "toColumns\(" …` / `grep -rnoE` |
| `renderCard` | 43 archivos, "manual" | **44 props `renderCard={…}`**; **42 envuelven `<AutoEntityCard>`**, 1 vía `renderMethodCard()` que también lo envuelve, **solo 1 card realmente manual** (`app/(dashboard)/settings/jobs/JobsView.tsx:189`) | V (**cambia la hipótesis**) | ver §3.1 |
| Archivos `*Fields.ts(x)` | ~25 | **65** | V (cambia) | `find features app components -name "*Fields.ts*" \| grep -v test \| wc -l` |
| Campos `computed` | — | **51** en 35 archivos `*Fields` (0 fuera de `*Fields`) | V | `grep -rnE "type: ['\"]computed['\"]" … \| grep -v "Fields\.tsx\?:"` → solo comentarios del núcleo |
| Consumidores de la familia (`DataTable*`, `DataCell`, `AutoEntityCard`, `EntityCard`, `create*Column`) | >139 (ADR-0078) | **202 archivos** | V (cambia) | `grep -rlE "\b(DataTable\|DataTableView\|DataTableColumnHeader\|DataTableToolbar\|DataTablePagination\|DataCell\|AutoEntityCard\|EntityCard\|createEntityFields\|create[A-Z][a-zA-Z]*Column)\b" app features components hooks lib \| grep -v components/shared \| wc -l` |
| Archivos con `DataCell.` | — | 102 | V | ídem con `DataCell\.` |
| `<DataTable` / `DataTableView` | — | 45 / 51 archivos | V | ídem |
| Imports de `@/components/ui/table` fuera de `shared/` y `ui/` | — | 18 archivos (22 con `<table>`/`<Table>` incl. HTML) | V | `grep -rlE "from ['\"]@/components/ui/table['\"]" … \| grep -vE "components/(shared\|ui)/"` |
| Tablas paralelas compartidas | — | `ReportTable` 3 · `FormLineItemsTable` 6 · `AccountingLinesTable` 1 · `RelatedDocumentsTable` **0** (solo test; "lo consumirá en M3", `features/documents/hooks/useDocumentRelations.ts:7`) | V | `grep -rlE "<ReportTable" …` |
| Entradas en `entity-registry.ts` | — | 69 entidades, 62 con `viewPolicy.availableViews`; 1387 líneas | V | `grep -cE "^\s+'[a-z_]+\.[a-z_]+': \{" lib/entity-registry.ts` |
| Stories de Storybook | "instalado" | `.storybook/` existe; **0 archivos `*.stories.tsx`** | V | `find . -name "*.stories.tsx" -not -path "./node_modules/*" \| wc -l` |
| `frontend/audit-views.md` | obsoleto | Confirmado: cita `createDomainCardView` 3 veces y existen 0 usos en el código | V | `grep -c createDomainCardView audit-views.md` |
| ADRs 0054–0069, 0078 | — | Todos presentes; el último es **0086** | V | `ls docs/10-architecture/adr/` |

## 2. Lectura de los archivos núcleo (hallazgos directos)

| # | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| N1 | `renderCell` es un `switch` cerrado sobre `def.type`; un tipo nuevo obliga a editar el núcleo. `computed` es *"the sole escape hatch"*. | `entity-fields.tsx:370-549`, `:250-252` | V |
| N2 | **El layout depende del nombre de la clave**: regex sobre `def.key` deciden título (`/number\|code\|id\|display/`), subtítulo (`/name/`), prioridad de header (`/total\|salary/`) y si una moneda entra en el subtítulo (`/total/`). Renombrar un campo del serializer cambia la card y el orden de columnas. | `entity-fields.tsx:345`, `:727`, `:741`, `:791`, `:976-978` | V |
| N3 | `placement` gobierna a la vez zonas de la card y orden de columnas (`ZONE_ORDER title→subtitle→detail→header`); `toColumns()` replica la heurística del subtítulo de la card en modo estático. | `entity-fields.tsx:38-56`, `:898-934` | V |
| N4 | Dos capas de capacidad que se pisan: `toCardFields` (header 3, detail 10) y `classifyFields` (header 3 si un solo rol, **1 si roles mixtos**). | `entity-fields.tsx:1019-1035`; `AutoEntityCard.tsx:206-211` | V |
| N5 | La zona `detail` se enruta al **centro del header**; `bodyDetail` es siempre `[]`, así que el bloque `EntityCard.Body` de `AutoEntityCard` es código muerto. | `AutoEntityCard.tsx:247-251`, `:442-448` | V |
| N6 | Tipado débil del esquema: `key: (keyof T & string) \| (string & {})`, `column(key: string)` lanza en runtime, `render(fieldKey: string)`, `defs: Record<string, …>`, casts `value as number`, `sortingFn as never`. | `entity-fields.tsx:139`, `:311`, `:314`, `:942`, `:420-546`, `:844-845` | V |
| N7 | **Violación de la invariante #1**: `intent={item.intent as any}` en el subtítulo de la card. | `AutoEntityCard.tsx:390` | V |
| N8 | Formato duplicado: el subtítulo formatea moneda con `new Intl.NumberFormat('es-CL')` en línea, fuera de `DataCell.Currency`. | `AutoEntityCard.tsx:379` | V |
| N9 | Cuando un campo define `get`, la columna sigue usando `accessorKey: def.key` (salvo `tableOptions.accessorFn`): el orden y el filtro operan sobre el dato crudo, no sobre el valor mostrado. Además el subtítulo comprueba presencia con `entity[key]`, ignorando `get`. | `entity-fields.tsx:825-828`, `:716-720`, `:1141` | V (código) · P (impacto real) |
| N10 | `AutoEntityCard` lee `entity-registry` (`viewPolicy.cardVariant`, `cardConfig.workflow`, `cardConfig.dateLabel`, icono): segunda fuente de verdad de presentación junto a `*Fields.ts`. | `AutoEntityCard.tsx:291-297`, `:423-427`; `lib/entity-registry.ts:20-80` | V |
| N11 | `DataTable` concentra 4 layouts (`standalone/embedded/minimal/compact` con CSS Grid y su propio `gridTemplate`), toolbar, KPIs, analítica, bulk dock, vistas y paginación; detecta si está en un modal por DOM (`closest('[role="dialog"]')…`). | `DataTable.tsx:63-78`, `:139`, `:240-248` | V |
| N12 | `DataTableView` hereda todos los props de `DataTable` (`Omit<…>`) y añade 12 propios, entre ellos `renderCard` y `cardGroupBy` (deprecado). | `DataTableView.tsx:29-46` | V |
| N13 | Dos `journalEntryFields.ts` **distintos**: `app/(dashboard)/accounting/entries/` y `features/accounting/`. | `diff -q` → "son distintos" | V |

## 3. Inventario de consumidores

Fuente: subagente `Explore`, con comprobaciones puntuales propias. Las columnas inline son una **heurística** (`accessorKey:'…'` o `id:'…'`) que sobrecuenta donde `id:` aparece en filtros o tabs (marcado *). Los recuentos de `computed` y `renderCard` son exactos.

### 3.1 `renderCard`: la hipótesis cambia

Comando de verificación:
```bash
grep -rlE "renderCard=\{" app features components --include=*.tsx | grep -vE "__tests__|\.test\." | while read f; do
  grep -nE "renderCard=\{" "$f" | cut -d: -f1 | while read l; do
    sed -n "${l},$((l+25))p" "$f" | grep -qE "AutoEntityCard|render[A-Z][a-zA-Z]*Card\(" || echo "$f:$l"; done; done
# → JobsView.tsx:189 y PaymentMethodClientView.tsx:208 (este llama a renderMethodCard, que envuelve AutoEntityCard)
```

**43 de 44** `renderCard` son *wrappers* de `AutoEntityCard`, no cards a mano. Existen porque la card necesita entradas **por fila** que el esquema no puede expresar:

| Motivo del wrapper | Archivos (línea) |
|---|---|
| Icono o color de icono por fila | `EntriesClientView:149`, `TreasuryMovementsClientView:418`, `TreasuryAccountsClientView:165`, `PaymentMethodClientView:109`, `MovementClientView:342`, `ProductInsightsPanel:234`, `BankMovementsClientView:113` |
| `entityLabel` o `cardConfig` según modo (órdenes/notas, órdenes/facturas, NC/ND) | `SalesOrdersView:371`, `PurchasingOrdersClientView:881`, `SalesInvoicesClientView:107` |
| Miniatura de imagen e icono de categoría | `ProductClientView:609` |
| Avatar | `ContactsClientView:123` |
| Unir datos externos (overview) | `BankCenterClientView:121` |
| Card condicional (embebido) | `StockReport:205` |
| **Pass-through puro** (fields, entityLabel, acciones, defaultAction) | 29 archivos: BOM, SalaryAdvance, Employee, Absence, Payroll, Budgets, PosTerminal, POSSessions, PurchaseInvoices, Warehouse, UoM, Attributes, Documents, Subscriptions, UoMCategory, PricingRule, InventoryCount, Category, CreditLines, CardStatements, UnbilledCharges, Checks, Loans, PaymentHardware ×2, TerminalBatches, Groups, UsersSettings, Partners |
| **Card 100 % manual** (barra de progreso) | `JobsView:189` |

Conclusión (V): el coste real de `renderCard` es **cableado repetido** (acciones, `defaultAction`, `entityLabel`, `key`) más **falta de entradas de identidad por fila** (icono, avatar, media). No son zonas insuficientes; eso solo se demuestra en `JobsView`.

### 3.2 Superficies de tabla

- **Híbridos `column()` + columnas inline** (el esquema no cubre toda la tabla): `WorkOrdersPageClient` (folio y estado inline, el resto con `workOrderFields.column()`), `UoMClientView`, `WarehouseClientView` y `UnbilledChargesClientView` (Fields para la card, ColumnDef inline para la tabla). V
- **Pantallas de lista sin `*Fields` efectivo:** `settings/audit`, `settings/jobs`, `accounting/accounts/[id]/ledger` (aunque `ledgerMovementFields` existe), `treasury/reconciliation/*`, `BlacklistClientView` (tabla cruda, aunque `blacklistFields.ts` existe), `DraftCartsClientView`, `ProfitDistributionsTab`, `HRSettingsView`, `BudgetVarianceTable`, `CashFlowTable`, `ProfileView`. P (barrido heurístico)
- **Tablas crudas (`<table>`/`<Table>`) en features:** 22 ubicaciones (corregido en la Fase 1: **21 en 19 archivos**; `NoteStep_LineItems.tsx:64` no es tabla cruda). Casi todas son **grillas de líneas editables** en wizards y modales (checkout, recepción, despacho, notas, OC, materiales de OT, distribuciones de socios), más 2 reportes (flujo de caja, varianza de presupuesto), 1 selector (`ProductSelector:373`) y 1 desglose en card (`PayrollCard:234`). V (ubicaciones) · P (propósito)

### 3.3 Top de rigidez (renderCard + computed + columnas inline)

| # | Archivo | Puntuación | Notas |
|---|---|---|---|
| 1 | `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx` | 1 + 2 + 66* | Modo órdenes/facturas; 881 líneas antes del `renderCard` |
| 2 | `features/sales/components/SalesOrdersView.tsx` | 1 + 3 + 45* | Modo órdenes/notas; 3 `computed` |
| 3 | `features/hr/components/PayrollClientView.tsx` | 1 + 0 + 39* | |
| 4 | `features/inventory/components/ProductClientView.tsx` | 1 + 2 + 22 | Imagen, icono de categoría |
| 5 | `features/settings/components/partners/PartnersClientView.tsx` | 1 + 0 + 23 | |
| 6 | `features/treasury/card-statements/UnbilledChargesClientView.tsx` | 1 + 1 + 15 | Tabla inline, card por Fields |
| 7 | `features/treasury/card-statements/StatementsClientView.tsx` | 1 + 0 + 15 | |
| 8 | `features/profile/components/ProfileView.tsx` · `features/treasury/loans/LoanDetailModal.tsx` | 11 | Embebidas |
| 9 | `TreasuryMovementsClientView` · `ReconciliationPanel` · `MovementClientView` | 10 | |
| 10 | `features/inventory/components/InventoryCountClientView.tsx` | 10 | Card con líneas |

El inventario completo por archivo (≈110 filas) está en [`00-consumer-inventory.md`](00-consumer-inventory.md) y se regenera con los comandos que allí figuran.

### 3.4 `computed` por archivo `*Fields` (51 en total)

`salesOrderFields` 3 · `purchaseOrderFields`, `productFields`, `orderLineFields`, `purchaseReceiptLineFields`, `purchaseReturnLineFields`, `saleDeliveryLineFields`, `statementFields`, `creditHistoryEntryFields`, `creditLedgerEntryFields`, `ledgerMovementFields`, `taxPeriodFields`, `statementChargeFields`, `terminalBatchFields` 2 cada uno · 21 archivos con 1 (`purchaseInvoice`, `salesInvoice`, `contact`, `creditContact`, `budget`, `salaryAdvance`, `attribute`, `category`, `inventoryDocumentDetail`, `inventoryDocument`, `invoiceLine`, `bom`, `workOrder`, `saleReturnLine`, `partnerLedger`, `profitDistributionLine`, `user`, `treasury/account`, `unbilledCharge`, `check`, `paymentMethod`). Las rutas `archivo:línea` las fija la Fase 1.

## 4. Entorno

| Elemento | Estado | Evidencia |
|---|---|---|
| Node local | v18.19.1 (vitest no corre en local) | `node -v` |
| Mutagen `erpgrafico-sync` | ✅ Connected: Yes / Watching | `mutagen sync list` |
| Contenedores remotos | ✅ backend, celery-beat, celery-worker, db, frontend, nginx, redis en `running` | `ssh pato@192.168.1.86 'cd ERPGrafico && docker compose ps'` |
| Vitest remoto | ✅ Node v20.20.2 en el contenedor; `components/shared/DataTableExpandHeader.test.tsx` → 1 archivo, 4 tests en verde (12,1 s) | `docker compose exec -T frontend npx vitest run components/shared/DataTableExpandHeader.test.tsx` |
| Storybook | Instalado, sin stories (banco de trabajo vacío para la Fase 5) | §1 |
| Guardas existentes relevantes | ESLint: `pagination-datatable-needs-rowcount`, `status-must-use-statusbadge`, `no-raw-tailwind-colors`, `typography-token-first`. Tests de contrato: `lib/__tests__/semantic-ink.test.ts`, `animate-in.contract.test.ts` | `ls eslint-rules/`; `grep -l … lib/__tests__/*` |

## 5. Pantallas representativas (10)

| # | Pantalla | Archivo | Por qué |
|---|---|---|---|
| S1 | Órdenes y facturas de compra | `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx` | **Mayor rigidez**; documental; `entityLabel` por modo |
| S2 | Órdenes de venta y notas | `features/sales/components/SalesOrdersView.tsx` | **Documental (OV)** con ficha; 3 `computed` (máximo); modo por pestaña |
| S3 | Productos | `features/inventory/components/ProductClientView.tsx` | Miniatura, icono de categoría, 2 `computed`, 22 columnas inline |
| S4 | Órdenes de trabajo | `app/(dashboard)/production/orders/WorkOrdersPageClient.tsx` | **Imprenta (OT)**; híbrido `column()` + inline; el `computed` de `workOrderFields` no llega a la tabla |
| S5 | Unidades de medida | `features/inventory/components/UoMClientView.tsx` | **Trivial**; aun así tabla inline y `renderCard` pass-through |
| S6 | Socios | `features/settings/components/partners/PartnersClientView.tsx` | 23 columnas inline; muchos flujos embebidos |
| S7 | Cargos no facturados | `features/treasury/card-statements/UnbilledChargesClientView.tsx` | Fields solo para la card; tabla manual |
| S8 | Movimientos de tesorería | `features/treasury/components/TreasuryMovementsClientView.tsx` | Icono por fila (INBOUND/OUTBOUND/WRITE_OFF), flujos de dinero |
| S9 | Líneas de la OV en la ficha | `features/orders/components/sheet/OrderSummaryTab.tsx` | Lista embebida en ficha documental; `orderLineFields` con 2 `computed` |
| S10 | Trabajos en segundo plano | `app/(dashboard)/settings/jobs/JobsView.tsx` | Única card 100 % manual (progreso); sin `*Fields` |

Fuera de la selección, a revisar en la Fase 1 como **familia**: las 22 tablas crudas de líneas editables (p. ej. `features/sales/components/DeliveryDrawer.tsx:427`). Los formularios están fuera de alcance, pero hay que decidir si son colección o formulario.

## 6. Causas de rigidez tentativas (a validar en la Fase 1)

| ID | Causa raíz tentativa | Señal (Fase 0) | Estado |
|---|---|---|---|
| R1 | **Registro de tipos cerrado**: `FieldType` + `switch`; lo que no encaja se va a `computed` (JSX opaco sin semántica ni formato compartido). | N1; 51 `computed`; 10/23 `DataCell` inalcanzables | P |
| R2 | **Layout inferido de nombres y roles**: regex sobre la clave y `TYPE_TO_ROLE` → `ROLE_TO_PLACEMENT` → capacidades. Resultado poco predecible e imposible de declarar directamente. | N2, N4 | P |
| R3 | **Acoplamiento card ↔ tabla** vía `placement`: el orden de columnas copia la heurística de la card. | N3; ADR-0057/0059 | P |
| R4 | **La card no recibe identidad por fila desde el esquema** (icono, color, avatar, media, entityLabel por modo), y el cableado de acciones se repite en cada vista. | 43 wrappers `renderCard` (§3.1) | V (síntoma) · P (causa) |
| R5 | **El esquema no cubre la tabla completa**: acciones, expansor, hub, selección y columnas especiales quedan fuera → híbridos `column()` + inline y factories `create*Column`. | §3.2; usos de `createActions/Expander/HubTrigger` | P |
| R6 | **Componente de colección monolítico**: 57 props + 4 layouts internos; no cubre grillas editables, reportes ni selectores → 22 tablas crudas y 3 tablas compartidas paralelas. | N11, N12, §3.2 | P |
| R7 | **Varias fuentes de verdad de presentación**: `*Fields.ts` + `entity-registry` (`viewPolicy`, `cardConfig`, `partnerField`, `workflow`) + props de la vista; `*Fields` duplicados y divergentes. | N10, N13 | V |
| R8 | **Tipado y formato débiles**: claves `string`, casts, `as any`, formato en línea, orden sobre el dato crudo. | N6–N9 | V |

## 7. Lo que ya se ve que funciona (a preservar; se amplía en la Fase 1)

- Declarar los campos una vez y obtener tabla y card (65 archivos lo usan).
- La unión discriminada de opciones por tipo (ADR-0066) ya rechaza props inválidos en compilación.
- `DataCell` centraliza la tipografía y la tinta semánticas (guardado por `semantic-ink.test.ts`).
- `EntityCard` ya es compound (`EntityCard.Header/Body/Field/…`): una base de composición aprovechable.
- Columna construida por clave (`column(key)`) en lugar de por posición.
