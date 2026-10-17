# 01 · Forense de la rigidez (Fase 1)

> Fecha: 2026-10-17 · Sin cambios de código. Rutas relativas a `frontend/`.
> Leyenda de evidencia: **V** = Verificado · **P** = Probable · **Pd** = Pendiente · **DP** = Decisión propuesta · **Pd-backend** = depende del serializer.
> Fuentes: lectura propia del núcleo y de los archivos citados, más dos barridos `Explore` (51 `computed`; columnas inline y tablas crudas) con comprobaciones puntuales (§7).

## 0. Decisiones del usuario que aplican a esta fase (2026-10-17)

1. **Tablas crudas de wizards y modales:** entran como **caso de uso específico** (contextos de wizard y modal). Se analizan en el §2.4 y alimentan requisitos de la Fase 2, no se tratan como formularios fuera de alcance.
2. **`as any` en `AutoEntityCard.tsx:390`:** no se corrige ahora; espera al rediseño.
3. **`journalEntryFields.ts` duplicado:** lo determina la auditoría (§5, TC-016).

---

## 1. Resumen: las 8 causas estructurales

| ID | Causa raíz | Escapes atribuidos | Archivos/entidades afectadas | Estado |
|---|---|---|---|---|
| **RC1** | **Vocabulario de valores cerrado**: `FieldType` es una unión cerrada que se resuelve en un `switch` del núcleo; lo que no cabe se va a `computed` (JSX opaco). | 51 `computed` + ~8 celdas especiales en columnas inline | 35 `*Fields` + 8 vistas | V |
| **RC2** | **Layout inferido, no declarado**: rol por tipo → zona por rol → capacidades, más regex sobre el nombre de la clave. Para obtener lo deseado hay que *pelear* contra la inferencia. | 43 `placement: 'detail'` + 12 `fieldRole: 'descriptive'` de corrección + hack `subtitle.renderer: () => []` | 9 `*Fields` de líneas + todas las que usan auto-layout | V |
| **RC3** | **Acoplamiento card ↔ tabla**: el orden de columnas copia la heurística de la card (`placement`), aunque la entidad no tenga card. | Los mismos 43 overrides (motivo declarado en el código) | Todas las listas embebidas de líneas | V |
| **RC4** | **La card no expresa identidad ni cableado por fila**: icono o color según el estado, avatar, miniatura, `entityLabel` por modo, acciones y `defaultAction` se pasan a mano en cada vista. | 44 `renderCard` (931 líneas; mediana 13) | 43 vistas | V |
| **RC5** | **El esquema describe valores, no la colección**: selección, acciones, expansor, columnas ocultas de facetas, modos de vista (órdenes/notas) y conjuntos de campos alternativos quedan fuera → columnas inline y duplicación. | ~52 columnas inline en 16 vistas (14 duplican campos ya definidos) | Compras, OV, inventario, OT, UoM, Warehouse, Jobs, Audit, Blacklist… | V |
| **RC6** | **Componente de colección monolítico y cerrado a composición**: 57 props (9 sin uso, 12 con un único consumidor), 4 layouts internos y ningún soporte de filas editables, agrupación jerárquica ni pie de totales declarativo. | 21 tablas crudas en 19 archivos + 3 tablas compartidas paralelas | Wizards, modales, reportes, selector | V |
| **RC7** | **Varias fuentes de verdad de presentación**: `*Fields.ts`, `entity-registry` (`viewPolicy`, `cardConfig`, `workflow`, icono), `TYPE_TO_LABEL` en `DataTableCells`, props por vista y `*Fields` duplicados o huérfanos. | 6+ mecanismos paralelos | Transversal | V |
| **RC8** | **Tipado débil y formato disperso**: claves `string`, `exclude` y `column()` sin comprobación, orden sobre el dato crudo, formateo en línea, `as any` y `as unknown as`. | 1 bug visible, 1 no-op silencioso, 10+ formateos en línea | Transversal | V |

El detalle y la evidencia de cada una están en el §3. El registro de escapes que las sustenta está en el §2.

---

## 2. Registro de escapes

### 2.1 Campos `computed` (51) → RC1

Clasificación completa: el barrido indicó líneas exactas para los 51 (lista en `00-consumer-inventory.md`). Nota: la mitad usa `type: "computed"` con comillas dobles.

| Cat. | Necesidad (producto) | Nº | Escapes (`features/…`) | Restricción que lo impidió | Coste |
|---|---|---|---|---|---|
| **A · Referencia a entidad o documento** | Enlazar a otro documento o entidad (producto de la línea, movimiento de stock, OV, OT, socio, banco) con texto de respaldo si no hay enlace | **20** | `orders/orderLineFields.tsx:16,:58` · `orders/invoiceLineFields.tsx:14` · `purchasing/purchaseReceiptLineFields.tsx:14,:33` · `purchasing/purchaseReturnLineFields.tsx:11,:30` · `sales/saleDeliveryLineFields.tsx:14,:33` · `sales/saleReturnLineFields.tsx:11` · `credits/creditHistoryEntryFields.tsx:14,:25` · `credits/creditLedgerEntryFields.tsx:16` · `inventory/inventoryDocumentFields.tsx:38` · `production/workOrderFields.tsx:9` · `settings/profitDistributionLineFields.tsx:13` · `treasury/checks/checkFields.tsx:30` · `treasury/accountFields.tsx:27` · `finance/budgetFields.tsx:9` · (+`contact` con enlace en `creditHistory:14`) | No existe un tipo `reference`. `contact` cubre solo contactos; `DataCell.Entity` y `DataCell.Link` no son alcanzables. `DocumentRefLink` (ADR-0086) aparece 14 veces vía `computed`. | El enlace "producto o nombre plano" está **copiado de forma idéntica en 4 archivos**; el de `stock_move`, en 3. Cada uno decide su propio `—`. |
| **B · Valor compuesto** | Nombre + código, total + conciliadas, "n de m", cuenta + chips de uso, proveedor + método | **7** | `finance/bank-reconciliation/statementFields.tsx:24` · `hr/salaryAdvanceFields.tsx:8` · `production/bomFields.tsx:12` · `treasury/card-statements/statementChargeFields.tsx:60` · `treasury/card-statements/unbilledChargeFields.tsx:19` · `treasury/paymentMethodFields.tsx:29` · `treasury/terminalBatchFields.tsx:30` | Un campo = un valor; no hay línea secundaria, ratio ni valor compuesto tipado. | Markup ad hoc (`raw span`, overrides de `Chip`), alineación manual. |
| **C · Formato condicional** | El mismo valor cambia de forma según el estado (precio "Dinámico", vencido con días, bloqueo automático, pagado/pendiente) | **4** | `inventory/productFields.tsx:35` · `credits/creditLedgerEntryFields.tsx:29` · `credits/creditContactFields.tsx:22` · `tax/taxPeriodFields.tsx:51` | Las opciones por fila existen solo para algunas props (`intent`, `direction`); no hay "variante según predicado". | `taxPeriod:51` reutiliza el estado `VOIDED` para mostrar "Pendiente" (semántica falsa). |
| **D · `DataCell` inalcanzable** | Barra de progreso, icono de categoría, resumen de workflow | **4** | `statementFields.tsx:37` (usa `ui/Progress`, **no** `DataCell.Progress`) · `inventory/categoryFields.tsx:8` (icono a mano, **no** `DataCell.Icon`) · `purchasing/purchaseOrderFields.tsx:45` · `sales/salesOrderFields.tsx:92` (`DataCell.WorkflowSummary`) | 10 de 23 `DataCell` no tienen `FieldType`. | Dos implementaciones de progreso y dos de icono conviven. |
| **E · Visual de dominio** | Resumen de valores de atributo, flags de disponibilidad, mosaico de período mes/año, descripción multilínea de cargo | **4** | `inventory/attributeFields.tsx:13` · `inventory/productFields.tsx:53` · `tax/taxPeriodFields.tsx:7` · `treasury/card-statements/statementChargeFields.tsx:13` | Sin registro abierto: un renderer propio de la entidad solo puede entrar como `computed`, perdiendo semántica (orden, filtro, formato en card). | Formato en línea (`substring(0,3)`, `toLocaleDateString`). |
| **F · Falta una opción** | Fecha + hora tomadas de dos campos, rango de fechas, tooltip/truncado, icono previo, estado derivado, chips múltiples | **8** | `accounting/ledgerMovementFields.tsx:9,:25` · `settings/partnerLedgerFields.tsx:50` (copia exacta de `ledger:9`) · `contacts/contactFields.tsx:46` · `sales/salesOrderFields.tsx:66` · `settings/userFields.tsx:48` · `treasury/terminalBatchFields.tsx:10` | Cada opción nueva exige tocar la unión y el `switch` del núcleo (ADR-0066). | `toLocaleTimeString` y `date-fns format` en línea. |
| **G · Estado de hub documental** | Estado multi-dimensión del documento (recepción/facturación/tesorería) | **4** | `billing/purchaseInvoiceFields.tsx:33` · `billing/salesInvoiceFields.tsx:28` · `purchasing/purchaseOrderFields.tsx:28` · `sales/salesOrderFields.tsx:49` | No hay tipo `hubStatus`; se usa `computed` + `fieldRole: 'complex'`. | Además, 2 columnas inline lo repiten (§2.3). |

**Opciones que faltan (agregado de F y notas secundarias):** `timeFrom` (2), `rangeEnd` (1), `tooltip/truncate` (1), `leadingIcon` (3), `subtitle`/línea secundaria (4), `status.derive` → {status, label, intent} (2), `chip` múltiple con filtro (3), `ratio` "n/m" + `emptyLabel` (2), `overdueDays` (1), `contact.linkId` (2), `emptyLabel` genérico en referencias (≈15). **Lectura:** con un vocabulario cerrado, cada una sería otra rama del núcleo. Es justo el antiobjetivo "esquema universal".

**Tipos que más `computed` eliminarían:** `reference` (≈17–20), `hubStatus` (4), `workflowSummary` (2), `progress` (1), `composite` o línea secundaria (≈7).

### 2.2 `renderCard` (44) → RC4

V: `00-system-map.md` §3.1. Medición nueva:

```bash
# longitud de cada bloque renderCard (hasta el cierre del JSX)
… | awk '…'  → n=44 total=931 líneas, media 21,2, mediana 13, mín 8, máx 110
# props pasadas a <AutoEntityCard> en vistas (ventana de 15 líneas tras la etiqueta; P)
entityLabel=44 actions=38 defaultAction=25 onClick=25 icon=20 iconClassName=13 isSelected=4 title=4
variant=3 subtitle=3 overviewMetrics=3 hubTrigger=2 avatar=1 imageSrc=1 trailing=0 center=0 children=0 hubStatusRenderer=0
```

| Necesidad | Nº | Restricción | Coste |
|---|---|---|---|
| Cablear `entityLabel` + acciones + `defaultAction`/`onClick` + `key` | 43 (29 son **solo** esto) | `DataTableView` ya recibe `entityLabel` y las acciones existen en `createEntityActions`, pero no hay un contrato "entidad → card" que los conecte. | ~400 líneas de pass-through (P: 29 × mediana 13) |
| Icono o color de icono según el estado de la fila | 7 | `AutoEntityCard` acepta `icon` estático; `cardConfig.iconClassName` en el registro solo cubre algunos casos. | Resolvers de icono por vista (`resolveStockMoveIcon`, `resolveTreasuryMovementIcon`) |
| `entityLabel` o estilo según el modo (órdenes/notas, NC/ND) | 3 | Una vista = una entidad. | Ramas condicionales en el `renderCard` más grande (S1, S2) |
| Avatar o miniatura | 2 | Sin slot de media en el esquema. | — |
| Datos externos (overview) | 1 | La card solo ve la fila. | `overviews.find` por render (`BankCenterClientView:121`) |
| Progreso (card 100 % manual) | 1 | Sin zona ni tipo `progress`. | Card fuera del sistema: sin estados ni densidad compartidos (`JobsView:189`) |

**Props muertas de `AutoEntityCard`** (P, ventana de 15 líneas): `trailing`, `center`, `children`, `hubStatusRenderer` → 0 usos. Junto con el `bodyDetail` muerto (TC-008), indican zonas diseñadas que nadie usa: la rigidez **no** viene de falta de zonas.

### 2.3 Columnas inline (16 vistas, ~52 columnas) → RC5, RC1, RC8

| Motivo | Nº | Escapes | Restricción |
|---|---|---|---|
| **Duplica un campo ya definido** | 14 | `PurchasingOrdersClientView.tsx:726-765` (notas: tipo, folio, fecha, proveedor, total; `purchaseInvoiceFields` existe) · `SalesOrdersView.tsx:322-344` (ídem; `salesInvoiceFields` existe) · `UnbilledChargesClientView.tsx:255` (`chargeType`) · `UoMClientView.tsx:111` (`uom_type`, que ya tiene mapa de estados en `uomFields.ts:43`) · `InventoryCountClientView.tsx:251,:257,:311` (`inventoryCountLineFields.ts` **nunca se importa**, V) | La vista tiene **modos** (órdenes ↔ notas) con conjuntos de campos distintos; `DataTableView` recibe un único `columns` y no hay composición de "vistas por modo". Además, los `*Fields` de notas añaden un hub de una entidad (`billing.invoice`) que no se puede inyectar. |
| Selección | 4 | `ProductClientView:217`, `WorkOrdersPageClient:131`, `UoMClientView:80`, `WarehouseClientView:101` | La selección no es una capacidad de la colección; cada vista escribe su checkbox. |
| Celda especial sin `FieldType` | ~8 | `DomainHubStatus` ×2 (`PurchasingOrders:765`, `SalesOrders:344`) · `QuantityDisplay` y `EditableQtyCell` (`InventoryCount:270,:280`) · progreso ×2 (`InventoryCount:323`, `JobsView:78`) · `DataCell.Entity` (`WorkOrders:162`) · Button + StatusBadge (`Unbilled:206`) | RC1 |
| Compuesta o condicional por fila | ~7 | `Partners:462` (chip "Exceso"), `Unbilled:243` (sobrescribe `cell` de `column("amount")`), `InventoryCount:292,:334`, `WorkOrders:179` (chip "Atrasada" + `filterFn`), `Audit:57,:99` | RC1 (sin variantes por predicado) |
| Columnas ocultas solo para facetas | 3 | `PurchasingOrders:822,:833,:844` (`accessorFn` + `header/cell: null`) | El filtro facetado exige una columna; no hay "dimensiones de filtro" separadas de las columnas visibles. |
| Acciones sin factory | 2 | `InventoryCount:351`, `JobsView:112` | `createActionsColumn` no cubre "chevron" ni "descargar". |
| Sin `*Fields` | 11 | `JobsView` (5 + acciones), `AuditPageClient` (6) | Entidades técnicas sin entrada en el sistema. |
| Campo ausente del esquema | 3 | `PurchasingOrders:813`, `WorkOrders:162`, `Blacklist:220` | Deriva entre esquema y vista. |

### 2.4 Caso de uso específico: colecciones en wizards y modales (21 tablas crudas) → RC6

> Corrección del inventario de la Fase 0: `features/notes/components/steps/NoteStep_LineItems.tsx:64` **no** es una tabla cruda (es una ColumnDef y la vista usa `<DataTable>` en `:264` y `:419`). Total: **21 ubicaciones en 19 archivos**.

| Patrón | Nº | Ubicaciones | Requisitos que revela |
|---|---|---|---|
| **P1 · Cantidad a procesar por línea** (Producto · Pendiente · *A procesar* `max = pendiente` · Unidad · [Stock/Costo/Estado]) | 7 | `sales/components/DeliveryDrawer.tsx:427` (`max` en `:511`) · `sales/components/checkout/Step3_Delivery.tsx:173` (`:213`) · `purchasing/components/ReceiptModal.tsx:286` (`:334`) · `purchasing/components/checkout/Step4_Receipt.tsx:231` (`:258`) · `billing/components/checkout/Step2_Logistics.tsx:228` (`:282`) · `orders/components/NoteLogisticsModal.tsx:174` (P) · `billing/components/checkout/Step1_Items.tsx:87` (corrección) | Filas fijas derivadas de un documento origen; celda numérica editable con tope por fila; validación y estado de error por fila; columnas de contexto (stock, costo); densidad de wizard. **Mismo markup repetido 7 veces** en ventas, compras, facturación y notas. |
| **P2 · Reparto de montos contra un tope** (Fila · Disponible · *monto(s)* · Diferencia + fila de totales) | 5 → **4** (corregido en la Fase 2: `BillChargesModal` no es editable y pasa a P5) | `settings/components/partners/CreateDistributionFlow.tsx:343` · `MassPaymentWizard.tsx:118` · `MobilizeEarningsWizard.tsx:124` · `finance/bank-reconciliation/components/SplitAllocationDialog.tsx:151` · `treasury/card-statements/BillChargesModal.tsx:232` | Varias celdas de monto editables; pie de totales y diferencia; estado destructivo al exceder el tope; en `BillCharges`, filas agrupadas y expandibles. |
| **P3 · Editor de líneas** (añadir/quitar; producto, cantidad, unidad, costo, subtotal) | 3 | `purchasing/components/PurchaseOrderModal.tsx:256` y `:413` (**dos copias idénticas**, V) · `SplitAllocationDialog` (también en P2) | Filas dinámicas; selector de producto en celda; subtotal calculado. `FormLineItemsTable` encajaría, pero solo aporta chrome (cabecera + botón añadir; las filas las escribe el consumidor). |
| **P4 · Reporte jerárquico o agrupado** | 3 | `finance/components/BudgetVarianceTable.tsx:167` (árbol recursivo con sangría) · `finance/components/CashFlowTable.tsx:151,:251` | Filas jerárquicas, subtotales por sección, columnas agrupadas (mes/YTD). |
| **P5 · Resumen de solo lectura o subtabla** | 4 | `components/selectors/ProductSelector.tsx:373` · `production/components/WorkOrderWizard.tsx:859` · `credits/components/BlacklistClientView.tsx:125` (dentro de `renderSubComponent`) · `Step4_Receipt.tsx:284` (fecha por fila) | Variante mínima sin chrome; tabla dentro de una fila expandida. |
| **P6 · Card contable de dos columnas** | 1 | `hr/components/PayrollCard.tsx:234` | Haberes y descuentos con fila de totales (`colSpan`). |
| **P7 · Pestaña de formulario con controles** | 1 | `inventory/components/product/ProductVariantsTab.tsx:285` | Checkbox, modo de precio y precio en línea. |

**Restricción común:** `DataTable` es una tabla de **lectura** con paginación y toolbar. No tiene modelo de celda editable, validación por fila, pie de totales declarativo ni agrupación jerárquica; la variante `compact` (CSS Grid) existe, pero solo para lectura. `InventoryCountClientView:280` mete `EditableQtyCell` dentro de `DataTable`: **la demanda existe incluso dentro del sistema**.

**DP (para la Fase 2):** tratar P1 y P2 como superficies de colección **editables** de primera clase (contexto wizard/modal), con un contrato de fila (tope, validación, error) y de pie (totales/diferencia). P3 se evalúa junto con `FormLineItemsTable`. P4 es la variante "reporte" (jerarquía y subtotales).

### 2.5 Props con un solo consumidor o sin consumidores → RC6

```bash
FILES=$(grep -rlE "<DataTable(View)?\b" app features components --include=*.tsx | grep -vE "components/shared/(DataTable|DataTableView)\.tsx|__tests__|\.test\.|\.stories\.")   # 92 archivos
for p in <props de DataTableProps + DataTableViewProps>; do echo "$(echo "$FILES" | xargs grep -lE "\b$p=" | wc -l) $p"; done
# confirmación de cero usos fuera del núcleo: grep -rnE "\b$p\b" app features components hooks (excl. DataTable*, Toolbar)
```

| Uso | Props |
|---|---|
| **0 consumidores** (9) | `compactMaxHeight`, `density`, `gridGap`, `initialColumnFilters`, `initialColumnVisibility`, `initialSorting`, `renderFooter`, `sortOptions`, `tableContainerClassName` (`viewOptions` y `onViewChange` solo los usa `DataTableView` internamente) |
| **1 consumidor** (12) | `autoExpand` + `getSubRows` → `AccountsClientView` · `bulkDock` → `MappingConfigDrawer` · `cardGroupBy` (deprecado) → `SalaryAdvanceClientView` · `columnToggle` → `InventoryCountClientView` · `currentView` → `ContactDrawer` · `getRowClassName` → `RectificationStep` · `onRowSelectionChange` + `rowSelection` + `skeletonRows` → `ReconciliationPanel` · `renderRowActions` → `DraftCartsClientView` · `toolbarClassName` → `ProfileView` |
| 2–3 consumidores | `renderRow` (ReconciliationPanel, AddPartnerModal) · `kpiCards` (BudgetDetailView, SubscriptionsClientView) · `gridTemplate` (RectificationStep, DraftCarts, AccountSelector) · `renderSubComponent` (PortfolioTable, Blacklist, ProfileView) · `hiddenColumns`, `noBorder`, `defaultView`, `forceView`, `hideToolbar`, `pageSizeOptions`, `renderLoadingView`, `isHubOpen` |

**Lectura (V):** 21 de 67 props (DataTable + DataTableView) tienen 0 o 1 consumidor. Es el patrón "cada necesidad añade una prop" en estado avanzado. `density` no tiene consumidores, aunque `density-system.md` la documenta.

### 2.6 Overrides y hacks de configuración → RC2, RC3

| Escape | Nº | Evidencia | Necesidad | Restricción |
|---|---|---|---|---|
| `placement: 'detail'` en todos los campos | 43 en 9 archivos | `orders/orderLineFields.tsx` (8; comentario `:9`: *"`placement: 'detail'` en todos: la tabla sigue el orden de definición"*), `credits/creditLedgerEntryFields.tsx` (8), `settings/profitDistributionLineFields.tsx` (5), `inventory/inventoryDocumentDetailFields.tsx` (5), `sales/saleDeliveryLineFields.tsx` (4), `purchasing/purchaseReceiptLineFields.tsx` (4), `orders/invoiceLineFields.tsx` (4), `purchasing/purchaseReturnLineFields.tsx` (3), `sales/saleReturnLineFields.tsx` (2) | "Las columnas en el orden en que las escribí" | El orden de columnas se deriva de la card (RC3); no existe "orden explícito". **Las líneas de documento no tienen card**, y aun así pagan su heurística. |
| `fieldRole: 'descriptive'` en `computed` | 12 | mismos archivos | Evitar que el `computed` caiga en otra zona | Obligatorio por la doc del núcleo (`entity-fields.tsx:154-158`) |
| `subtitle: { renderer: () => [] }` | 1 | `inventory/attributeFields.tsx:19` | Apagar el subtítulo automático | No hay "sin subtítulo"; se fuerza con un renderer vacío |
| `subtitle.excludeKeys` + `renderer` | 2 | `inventory/productFields.tsx:67-68`, `treasury/paymentMethodFields.tsx:49` | Subtítulo propio sin duplicar campos | El auto-layout hay que desactivarlo campo a campo |
| `className` y estilos en definiciones | 15 en `*Fields` + overrides de tokens en 10 `computed` | p. ej. `features/settings/partnerFields.ts:32,:41`, `features/treasury/loans/loanFields.tsx:41`, `features/accounting/journalEntryFields.ts:41` (`truncate max-w-[300px]`) | Énfasis, truncado, estado atenuado | No hay variantes semánticas (énfasis, atenuado, truncado) en el vocabulario |
| Alineación manual en `computed` | casi todos | `flex justify-center w-full` repetido | Alinear el contenido | `tableOptions.align` alinea la cabecera, no el JSX libre |

### 2.7 Tipado y formato → RC8

| Escape | Evidencia | Efecto |
|---|---|---|
| **Bug: `exclude` con una clave inexistente** | `features/orders/components/sheet/OrderSummaryTab.tsx:51` pasa `exclude: ["work_order_summary"]` (clave del dato), pero `toColumns` filtra por la clave de la definición (`entity-fields.tsx:905`, `!excluded.has(k)`); la definición se llama `work_order` (`orderLineFields.tsx:55`) | **La columna "OT" no se excluye en las líneas de OC**, contra lo que dice el comentario `orderLineFields.tsx:76`. V (código); Pd (captura) |
| `exclude` sin efecto | `features/contacts/components/ContactDrawer.tsx:629` excluye `contactDisplayName`, que no existe en `workOrderFields` | No-op silencioso; con claves tipadas sería un error de compilación |
| API incoherente | `column(key)` busca por **clave del dato** (`entity-fields.tsx:940`); `toColumns({exclude})`, por **clave de la definición** (`:905`) | Causa directa del bug anterior |
| Cast de columnas | `ContactDrawer.tsx:625-629` → `as unknown as ColumnDef<Record<string, unknown>>[]` | Escape de tipos para mezclar entidades en una tabla |
| Orden sobre el dato crudo | `orderLineFields.tsx:30-38`: muestra `get` = `unit_price_net ?? unit_cost ?? …`, pero `accessorKey` es `unit_price` (bruto en OV, posiblemente ausente en OC); ídem `delivered` → `quantity_delivered` en OC (donde el dato es `quantity_received`) | Ordenar por la columna usa otro valor que el mostrado. V (código); P (impacto: depende de que la variante `minimal` permita ordenar) |
| Formateo en línea | `ledgerMovementFields.tsx:17`, `partnerLedgerFields.tsx:58` (`toLocaleTimeString`) · `statementChargeFields.tsx:~35` (`toLocaleDateString`) · `terminalBatchFields.tsx:17` (`date-fns format`) · `statementFields.tsx:45` (`Math.round()%`) · `taxPeriodFields.tsx:23` (`substring`) · `purchaseOrderFields.tsx:54-55`, `salesOrderFields.tsx:101-102` (`parseFloat`) · `JobsView.tsx:97` · `AutoEntityCard.tsx:379` (`Intl.NumberFormat`) | El mismo tipo de dato se formatea distinto según la superficie o la entidad |
| `as any` | `AutoEntityCard.tsx:390` | Invariante #1 (se corrige en el rediseño, decisión 2) |
| Cadenas de fallback en `get` | `orderLineFields.tsx:36,:44`; notas `supplier_name \|\| partner_name` (`PurchasingOrders:751`) | **Pd-backend**: los serializers de OV/OC/notas no comparten nombres de campo |

---

## 3. Causas raíz: detalle

### RC1 · Vocabulario de valores cerrado
- **Mecanismo (V):** `FieldType` (15 miembros, `entity-fields.tsx:14-29`) → unión discriminada de opciones (`:188-253`) → `switch` en `renderCell` (`:370-549`). Añadir un tipo o una opción obliga a tocar 3 lugares del núcleo compartido.
- **Escapes:** 51 `computed` (§2.1) + ~8 celdas especiales inline (§2.3) + 4 `DataCell` usados dentro de `computed` sin tipo propio (`ContactLink`, `Entity`, `WorkflowSummary`, y `Progress`/`Icon` reimplementados).
- **Lo que revela:** el 40 % de los `computed` son **referencias** (A). La mayor necesidad no cubierta es *"este valor apunta a otra entidad o documento"*, con un componente canónico ya existente (`DocumentRefLink`, ADR-0086). El resto se reparte entre composición (B), variantes por predicado (C) y renderers de dominio (E), que piden **extensión por entidad** y no más tipos en el núcleo.
- **Entidades:** líneas de OV/OC/factura/recepción/devolución/despacho, crédito, banco, presupuesto, producto, categoría, atributo, período tributario, cargos de tarjeta, lotes de terminal, usuarios.

### RC2 · Layout inferido, no declarado
- **Mecanismo (V):** `TYPE_TO_ROLE` → `ROLE_TO_PLACEMENT` → auto-título y auto-subtítulo por regex de la clave (`:791`, `:976-978`, `:727`, `:741`, `:345`) → capacidades en `toCardFields` (`:1019-1035`) → reglas de cabecera en `classifyFields` (3 si es un rol, **1 si son mixtos**, `AutoEntityCard.tsx:206-211`).
- **Escapes:** 43 + 12 overrides, 3 hacks de subtítulo (§2.6).
- **Coste:** cuatro capas de reglas que hay que entender para predecir dónde aparece un campo; renombrar una clave del serializer cambia el layout; las zonas `trailing/center/children/body` existen pero no se usan (§2.2).

### RC3 · Acoplamiento card ↔ tabla
- **Mecanismo (V):** `toColumns` ordena por `ZONE_ORDER` y replica `buildSubtitleOrder` en modo estático (`:898-934`), decisión explícita de ADR-0057/0059.
- **Escapes:** los 43 `placement: 'detail'` existen **solo** para recuperar el orden de definición en tablas sin card (comentario `orderLineFields.tsx:9`). `surfaces` se usa 4 veces en todo el repo: la separación por superficie existe para *presencia*, pero no para *orden ni layout*.
- **Necesidad legítima a preservar (de ADR-0057/0059):** que card y lista no se contradigan en **qué** es importante. Esto pide compartir semántica (rol o importancia), no posición.

### RC4 · Identidad y cableado de la card fuera del esquema
- **Mecanismo (V):** `AutoEntityCard` recibe `fields` + 22 props; el icono sale del registro o de una prop estática; las acciones y el `defaultAction` vienen de `createEntityActions`, pero se conectan a mano.
- **Escapes:** 44 `renderCard`, 931 líneas (§2.2).
- **Coste:** cada vista nueva copia el bloque; la consistencia (p. ej. `defaultAction` frente a `onClick`, `key`) depende de cada autor: 25 vistas usan `defaultAction` y 25 `onClick`, con solapamiento (P).

### RC5 · El esquema describe valores, no la colección
- **Mecanismo (V):** `createEntityFields` produce `ColumnDef` de valor. Selección, acciones, expansor, hub trigger y facetas viven en factories (`create*Column`) o inline; `DataTableView` recibe un solo array `columns` y un solo `renderCard`.
- **Escapes:** ~52 columnas inline (§2.3), de las cuales **14 duplican campos ya definidos** porque la vista alterna modos (órdenes/notas) que corresponden a otra entidad (`billing.invoice`). Hay `*Fields` huérfanos: `inventoryCountLineFields.ts` (sin importar) y `blacklistFields.ts` (sin `toColumns`); el `computed` de `workOrderFields` no llega a la tabla de OT.
- **Coste:** S1 y S2, las dos pantallas más rígidas, son exactamente las de "vista con modos".

### RC6 · Colección monolítica y cerrada a composición
- **Mecanismo (V):** `DataTable` (1001 líneas, 57 props) contiene 4 layouts (`standalone/embedded/minimal/compact`), toolbar, KPIs, analítica, dock de acciones masivas, vistas, paginación y detección de modal por DOM (`DataTable.tsx:240-248`). `DataTableView` hereda todo (`Omit<…>`) y suma 12 props.
- **Escapes:** 21 props con 0–1 consumidores (§2.5); 21 tablas crudas (§2.4); `ReportTable`, `FormLineItemsTable` (solo chrome) y `AccountingLinesTable` en paralelo; `RelatedDocumentsTable` sin consumidores aún.
- **Lectura:** el componente no se deja **descomponer** (usar solo el cuerpo de la tabla, solo la fila, solo el pie) ni **extender** (celda editable, fila de totales, agrupación). Así que cada contexto distinto (wizard, reporte, selector) se va fuera.

### RC7 · Varias fuentes de verdad de presentación
- **Evidencia (V):**
  - `entity-registry.ts` (1387 líneas): `viewPolicy` (vistas, variante de card), `cardConfig` (icono, `iconClassName`, `dateLabel`, `workflow`), `partnerField`. `AutoEntityCard` lo lee (`:291-297`, `:423-427`).
  - `DataTableCells.tsx:65-95` mantiene su propio `TYPE_TO_LABEL` (snake_case → etiqueta de registro), paralelo al registro.
  - `DomainHubStatus label="billing.invoice"` se pasa por celda.
  - `*Fields` duplicados (`journalEntryFields`) y huérfanos (RC5).
- **Coste:** para saber cómo se ve una entidad hay que leer `*Fields`, el registro, la vista y, a veces, `DataTableCells`.

### RC8 · Tipado débil y formato disperso
- **Evidencia:** §2.7. El tipado actual garantiza las **opciones por tipo** (ADR-0066), pero no **claves válidas** (`key: … | (string & {})`, `column(key: string)`, `exclude: string[]`, `render(fieldKey: string)`) ni la **compatibilidad valor ↔ tipo** (`value as number`, `entity-fields.tsx:420-546`).
- **Coste:** 1 bug visible en producción (columna OT en las OC), 1 no-op silencioso, ≥10 formateos en línea, 1 `as any` y 1 `as unknown as`.

---

## 4. Lo que funciona y debe preservarse

| # | Fortaleza | Evidencia | Por qué preservarla |
|---|---|---|---|
| F1 | **Declarar los campos una vez** y obtener tabla y card | 65 `*Fields`, 62 vistas con `toColumns` y 47 con `AutoEntityCard` | Es el núcleo de la mantenibilidad. Las 29 vistas pass-through demuestran que, cuando el caso encaja, la card sale "gratis". |
| F2 | **Opciones validadas por tipo en compilación** | Unión discriminada, ADR-0066 (`entity-fields.tsx:183-253`) | Hay que extenderla a claves y valores, no perderla. |
| F3 | **Celdas con tipografía y tinta semánticas centralizadas** | `DataCell` + `semantic-ink.test.ts`; ADR-0061/0062/0065/0068 | Identidad visual heredada; los `computed` que la evitan son la fuente de las inconsistencias. |
| F4 | **Convención única de dato ausente** (`null`/`''` → `-`) | `toDisplayValue`, `entity-fields.tsx:365-368` | Requisito común sin configuración. |
| F5 | **Alineación numérica automática** | `NUMERIC_TYPES` → cabecera a la derecha (`:110`, `:820`) | Un default correcto que nadie tiene que recordar. |
| F6 | **Opciones por fila mediante callbacks** (`intent`, `direction`, `suffix`, `currency`, `className`) | `entity-fields.tsx:856-863` | El germen de las variantes por predicado (RC1-C). |
| F7 | **Columna por clave** (`column(key)`) en vez de por posición | `:936-949` | Debe hacerse tipada (RC8). |
| F8 | **`EntityCard` es compound** (12 subcomponentes) | `EntityCard.tsx:665-678` | Base de composición para layouts de card por entidad. |
| F9 | **Coherencia card ↔ lista en importancia** | ADR-0057/0059 | Necesidad legítima: compartir *rol/importancia*, no posición (RC3). |
| F10 | **Comportamiento de colección ya resuelto**: URL como fuente de verdad, paginación en servidor con `rowCount` (más la regla ESLint `pagination-datatable-needs-rowcount`), estados vacío/filtrado (`resolveEmptyState`), skeletons, dock masivo, `createEntityActions` | `DataTable.tsx:114-134`, `emptyStateResolver` | Restricciones duras del §2.2 del prompt. |
| F11 | **`DocumentRefLink` como enlace canónico** a documentos | 14 usos; ADR-0086 | Es exactamente el renderer de un futuro tipo `reference`. |

---

## 5. Decisiones propuestas en esta fase

- **DP-1 (TC-016) · `journalEntryFields.ts` canónico.**
  - Las dos copias son idénticas salvo la línea 49: la de `app/` añade `{ title: { field: 'display_id' } }` (`diff`).
  - La copia de `features/accounting/` **no la importa nadie** ni la exporta el barrel (`features/accounting/index.ts` solo exporta los `unifiedSearchDef`); el único consumidor es `EntriesClientView.tsx:10`, que importa la de `app/`.
  - Ambas llevan la misma historia git (último commit compartido: `a7c29f65f`, 2026-08-03).
  - **Determinación:** el **contenido canónico** es el de `app/` (en uso, con `meta.title`). La **ubicación canónica** es `features/accounting/` (FSD: la definición de presentación pertenece a la feature). La copia de `features/` es código muerto y desactualizado.
  - **Acción:** al migrar la entidad `accounting.journalentry` al nuevo sistema (Fase 7), su definición nace en `features/accounting/` y se borran ambas copias. No se toca nada antes de la Puerta C.
- **DP-2 · Colecciones editables de wizard/modal.** P1 (cantidad a procesar) y P2 (reparto de montos) se catalogan en la Fase 2 como superficies editables con contrato de fila y de pie (§2.4).
- **DP-3 · Bug de `exclude` en `OrderSummaryTab`.** Se registra (TC-012) y no se corrige (no se toca código hasta la Puerta C). Si el usuario lo prefiere, es un fix de una línea independiente de la auditoría.

## 6. Pendiente-backend

| ID | Hallazgo | Evidencia |
|---|---|---|
| PB-1 | Nombres de campo distintos entre OV y OC (y notas) para el mismo concepto (`unit_price_net`/`unit_cost`/`unit_price`/`price_unit`; `quantity_delivered`/`quantity_received`/…; `supplier_name`/`partner_name`) | `orderLineFields.tsx:36,:44`; `PurchasingOrdersClientView.tsx:751` |

## 7. Reproducibilidad y verificación

| Afirmación | Cómo se verificó |
|---|---|
| 51 `computed` y su categoría | Barrido `Explore` (lectura de cada definición); recuento cruzado con `grep -rnE "type: ['\"]computed['\"]"` (Fase 0, 51 en `*Fields`) |
| 43 `placement: 'detail'` en 9 archivos de líneas | `grep -rcE "placement: 'detail'" features app --include=*Fields.ts*` + lectura de `orderLineFields.tsx` |
| Bug de `exclude` | Lectura de `entity-fields.tsx:905` y `orderLineFields.tsx:55`; `grep -rnE "toColumns\(\{ *exclude"`; script de comprobación de claves por archivo |
| Props con 0–1 consumidores | Script del §2.5 + `grep` amplio de confirmación |
| 931 líneas de `renderCard` | Script awk del §2.2 (heurística de cierre de bloque; P en el detalle, V en el orden de magnitud) |
| Tablas crudas y patrones | Barrido `Explore` + comprobación de `max={…}` en 5 archivos y de las dos copias en `PurchaseOrderModal.tsx:256/:413` |
| `notes` duplican `*InvoiceFields` | Lectura de `PurchasingOrdersClientView.tsx:726-768` |
| `inventoryCountLineFields.ts` huérfano | `grep -rn inventoryCountLineFields features app` → solo su propia definición |
| No se ejecutaron tests | Esta fase no requiere ejecución; no se afirma ningún resultado de test |
