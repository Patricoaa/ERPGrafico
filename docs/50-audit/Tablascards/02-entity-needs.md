# 02 · Catálogo de necesidades por entidad (Fase 2)

> Fecha: 2026-10-17 · Sin cambios de código. Rutas relativas a `frontend/` (las que no empiezan por `app/` o `components/` están bajo `features/`).
> Fuentes: tres barridos `Explore` por dominio (ventas/compras/facturación · inventario/producción/RR. HH./configuración/contabilidad · tesorería/finanzas/perfil + wizard/modal), mediciones propias (§1) y comprobaciones puntuales (§8).
> Evidencia: **V** = Verificado · **P** = Probable · **Pd-backend** = depende del serializer. Las fichas son **V** en `archivo:línea` y **P** en la clasificación del tipo de valor.

## 1. Cifras transversales (medidas)

| Métrica | Valor | Comando |
|---|---|---|
| Políticas de vista en el registro | `list+card` 45 · `list+card+analytics` 9 · `list` 7 · `list+kanban+timeline` 1 (OT) | `grep -oE "availableViews: \[[^]]*\]" lib/entity-registry.ts \| sort \| uniq -c` |
| Vista por defecto | `list` 39 · `card` 24 | `grep -oE "defaultView: '[a-z]+'" …` |
| Variante de card | `full` 35 · `highlights` 12 · `workflow` 3 · `summary` 1 | `grep -oE "cardVariant: '[a-z]+'" …` |
| Configuraciones de búsqueda unificada | 38 en 12 archivos `unifiedSearchDef.ts`; 76 filtros (`single` 42, `date` 16, `range` 10, `multi` 7, `toggle` 1); 25 con `groupBy` | `grep -rhoE "type: ['\"][a-zA-Z]+['\"]" features --include=unifiedSearchDef.ts* \| sort \| uniq -c` |
| Vistas con `useUnifiedSearch` · `currentGroupBy` · `manualPagination` | 56 · 31 · 12 | `grep -rlE "<patrón>" app features components --include=*.tsx \| grep -vE "components/shared/\|__tests__" \| wc -l` |
| Vistas con `analyticsPanel` · `kpiCards` · `bulkActions` · `renderSubComponent` · `getSubRows` · `renderCustomView` · `openEntity(` | 9 · 2 · 7 · 3 · 1 · 5 · 16 | ídem |
| Exportación genérica desde colecciones | **0** (solo un CSV a mano en `finance/components/BudgetDetailView.tsx:101-115`) | `grep -rlE "export(To)?(Excel\|Csv\|Pdf)\|useExport" …` → 0 |
| CMYK como tipo de dato en colecciones | **0**. `CmykRing` es un adorno de marca (checkbox, radio, indicador de carga de `DataTable`) | `grep -rn CmykRing app features components` |

## 2. Alcance del catálogo

- **82 contextos de colección** (entidad × superficie significativa): 21 en ventas/compras/facturación, 36 en inventario/producción/RR. HH./configuración/contabilidad y 25 en tesorería/finanzas/perfil (§3).
- **11 colecciones editables** de wizard/modal (7 P1, 4 P2), tratadas como caso de uso específico (§4).
- **Etiquetas del registro sin vista de colección propia** (V, sin consumidor `entityLabel=`): `finance.bankjournal`, `finance.payment`, `treasury.transfer`, `treasury.cashmovement`, `treasury.cardpurchasegroup`, `treasury.cardpendingcharge`, `treasury.loaninstallment`, `workflow.task`, `inventory.customfieldtemplate`. Además, `sales.saledelivery`, `sales.salereturn`, `purchasing.purchasereceipt` y `purchasing.purchasereturn` declaran `list+card` en `viewPolicy`, pero solo se muestran como líneas dentro de drawers. Es política de vista **declarada y no usada** (RC7).

## 3. Fichas compactas por entidad

Columnas: **Sup.** = superficies (T tabla · C card · K kanban · TL timeline · A analítica · E embebida · X fila expandida · Tr árbol · R reporte) · **Valores** = tipos de valor relevantes · **Card** = qué necesita que las zonas no dan · **Interacción** · **Colección** · **Escapes** (detalle en `01-rigidity-forensics.md`).

### 3.1 Ventas, compras, facturación, contactos, crédito, POS

| # | Entidad · vista | Sup. | Valores | Card | Interacción | Colección | Dominio / escapes |
|---|---|---|---|---|---|---|---|
| 1 | `sales.saleorder` · `sales/components/SalesOrdersView.tsx:362` | T C A (card por defecto, `workflow`) | folio, contacto, fecha, **estado hub** (`DomainHubStatus`, card) + `stageSummary` (tabla), canal (chip-category), **resumen de workflow** (líneas/total/pendiente/entrega, solo tabla) | color de icono por `cardConfig.iconClassName` (fn); `hubTrigger`; atenuado del resto cuando el panel está abierto | clic → ficha documental (`useDocumentSheetRoute`) | paginación en servidor (se desactiva al agrupar, tope 200); groupBy fecha/cliente/estado/canal; 5 facetas multi de ejes hub + rango de total; analítica (6 KPI) | **Modo `orders`/`notes`** cambia entidad, columnas, datos, búsqueda y paginación (`:355-365`); la card de notas recibe `fields = undefined as unknown as …` (`:380`, V). Eje de producción (OT). 3 `computed` + 5 columnas inline. |
| 2 | `purchasing.purchaseorder` · `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx:872` | T C A (card, `workflow`) | folio, proveedor (**texto**, no contacto), fecha, fecha de recepción, estado hub, workflow, bodega (inline) | ídem 1 | clic → ficha; editar → `PurchaseOrderModal` | 3 columnas ocultas solo para facetas (`:820-855`); paginación en servidor solo en modo órdenes; analítica con embudo | Modo `orders`/`notes`; 2 `computed` + columnas inline de notas que duplican `purchaseInvoiceFields`. |
| 3 | `billing.invoice` (ventas) · `billing/components/SalesInvoicesClientView.tsx:104` | T C | folio con **prefijo DTE**, fecha, cliente (secundario, sin enlace), estado hub "Flujo", tipo DTE, total | tinte de icono para NC/ND | clic → hub; anular/eliminar con confirmación | groupBy; paginación en cliente | **NC muestra el total en positivo** (sin signo de flujo). 1 `computed`. |
| 4 | `billing.purchaseinvoice` · `billing/components/PurchaseInvoicesClientView.tsx:139` | T C | igual que 3 | — | anular con motivo, anulación forzada de pagos vinculados | groupBy | 1 `computed`. |
| 5 | `contacts.contact` · `contacts/components/ContactsClientView.tsx:96` | T C (`highlights`) | nombre + iconos de rol (`computed`), RUT, código, email, teléfono, roles (tags) | **avatar** (Blobatar vía `renderCard`) | clic → drawer | groupBy tipo/riesgo; paginación en cliente | 1 `computed`. |
| 6 | Sublistas del contacto · `contacts/components/ContactDrawer.tsx:698,:774` | E | reutiliza columnas de OV/OC/OT según tipo; documentos de crédito | — | `openEntity` por fila | — | **Modo que cambia de entidad** en una misma tabla; `toColumns().map(…)` posprocesado; `as unknown as ColumnDef<Record<string, unknown>>[]`. |
| 7 | `pos.session` · `sales/components/POSSessionsClientView.tsx:104` | T C | usuario, terminal, apertura/cierre (**rango de datetime** en dos campos), ventas (dinero), estado | — | — | groupBy | — |
| 8 | `pos.terminal` / `sales.posterminal` · `sales/components/PosTerminalClientView.tsx:95` | T C | código, nombre, ubicación, dispositivo, métodos de pago (tags), activo | — | eliminar con confirmación | — | **Dos entradas de registro** para la misma vista (RC7). |
| 9 | Carros en borrador · `pos/components/DraftCartsClientView.tsx:389` | T (compact, en diálogo) | — | — | clic → carga el carro; borrar por fila | — | Sin entrada de registro; 4 columnas inline; `renderRowActions` (consumidor único). |
| 10 | Líneas de OV/OC · `orders/components/sheet/OrderSummaryTab.tsx:86` | E (minimal) | producto (referencia), **cantidad + UoM**, precio unitario neto, entregado y facturado (**progreso** respecto de la cantidad, mostrado como números), **OT vinculada**, subtotal | — | producto y OT abren su ficha apilada | **sin pie de totales** | 2 `computed`; 7 `placement: 'detail'`; bug TC-012. |
| 11 | Líneas de factura · `orders/components/sheet/InvoiceSummaryTab.tsx:88` | E | producto, cantidad + UoM, precio, subtotal | — | — | sin pie | 1 `computed`. |
| 12–15 | Líneas de despacho, devolución, recepción y devolución de compra · `sales/components/SaleDeliveryDrawer.tsx:86`, `SaleReturnDrawer.tsx:89`, `purchasing/components/PurchaseReceiptDrawer.tsx:85`, `PurchaseReturnDrawer.tsx:91` | E (minimal) | producto (referencia con texto de respaldo), cantidad + UoM, **movimiento de stock** (referencia) | — | referencias abren ficha | — | 7 `computed` copiados casi idénticos entre los 4 archivos. |
| 16 | Cartera de crédito · `credits/components/CreditPortfolioClientView.tsx:159`, `PortfolioTable.tsx:146` | T X | nombre + aviso de bloqueo, riesgo, límite/usado/disponible/vencido (dinero; **usado/límite = progreso**), estado | — | expansión → `PortfolioContactPanel`; castigo con confirmación | pestañas `portfolio`/`history` cambian de tabla | 1 + 2 `computed`. |
| 17 | Historial de crédito · ídem | T | fecha, cliente (contacto), OV (referencia), monto, estado | — | — | — | 2 `computed`. |
| 18 | Libro de crédito · `credits/creditLedgerEntryFields.tsx` | E | documento (referencia), fecha, **vencimiento con días de atraso**, total, pagado (flujo), saldo, origen (chip), estado | — | — | — | 2 `computed`. |
| 19 | Lista negra · `credits/components/BlacklistClientView.tsx:237` | T X | cliente (contacto inline), crédito usado, última evaluación | — | expansión → subtabla cruda de deudas (`:125`) | facetas + groupBy | `blacklistFields.ts` existe y no se usa con `toColumns`. |
| 20 | Líneas de reparto de utilidades · `settings/components/ProfitDistributionDrawer.tsx` | E | socio (referencia), %, destino, compensación, neto | — | — | — | 1 `computed`. |
| 21 | `contacts.partnertransaction` · (ver 3.3 #25) | — | — | — | — | — | Registro `list`, sin vista de lista propia. |

### 3.2 Inventario, producción, RR. HH., configuración, contabilidad, impuestos

| # | Entidad · vista | Sup. | Valores | Card | Interacción | Colección | Dominio / escapes |
|---|---|---|---|---|---|---|---|
| 22 | `production.workorder` · `app/(dashboard)/production/orders/WorkOrdersPageClient.tsx` | T **K TL** (sin card grid) | folio (`DataCell.Entity`), OV (referencia), estado + **atraso**, **etapa** (enum con icono/color), vencimiento, fecha de OV, nº de materiales, **estado de tercerización** (parcial/total) | **card de kanban**: icono y color por etapa, badges de tercerización, aviso "sin materiales" en asignación de material (`features/production/components/WorkOrderKanban.tsx:60-124`) | selección (checkbox inline), acciones masivas (imprimir), acciones de fila | paginación en servidor (no al agrupar); groupBy estado/etapa; filtros estado, "mis tareas", rango de vencimiento; **timeline** por cubetas Hoy/Mañana/Semana/Sin fecha (`WorkOrderTimeline.tsx:42-54`); KPI en `ProductionMetricsCard.tsx:50-72` | **Imprenta**: etapas, tercerización, materiales, atraso. Kanban y timeline vía `renderCustomView`; 3 columnas inline. |
| 23 | Materiales y rectificación de OT · `production/components/WorkOrderWizard.tsx:859`, `steps/MaterialAssignmentStep.tsx`, `steps/RectificationStep.tsx` | E (wizard) | material, cantidad + UoM, costo, disponibilidad de stock | — | asignar y editar cantidades | — | **Imprenta**. Sin esquema: tabla cruda + 6–8 columnas inline; `getRowClassName` y `gridTemplate` (consumidores únicos). |
| 24 | `production.bom` · `production/components/BOMClientView.tsx` | T C | chips de código, estado, costo, producto + códigos (`computed`) | — | — | groupBy; filtro activo | 1 `computed`. |
| 25 | Líneas de LdM · `production/components/BOMManager.tsx:330`, `BOMDrawer.tsx:528,:789` | E | nombre, variante, **rendimiento + UoM**, estado, nº de componentes, actualización | — | — | **pie de totales calculado en línea** en `BOMDrawer` | **Imprenta**. 6 columnas inline. |
| 26 | `inventory.product` · `inventory/components/ProductClientView.tsx` | T C A (card por defecto) | código, categoría (chip), **precio bruto o "Dinámico"** (`computed`), stock, disponibilidad (flags), **imagen** | **miniatura** con icono por tipo como respaldo (`:609-623`) | selección, acciones masivas, clic → drawer; vista de detalle de stock al seleccionar (`renderCustomView` `:637`) | paginación en servidor; groupBy; analítica de 3 pestañas | 22 columnas inline, 2 `computed`. |
| 27 | Variantes de producto · `inventory/components/product/ProductVariantsTab.tsx:285` | E (pestaña de formulario) | valores de atributo, nombre de variante, modo de precio, precio, LdM, disponibilidad | — | matriz generadora con checkboxes por valor | — | Tabla cruda (P7). |
| 28 | `inventory.stockmove` · `inventory/components/MovementClientView.tsx` | T C A + E | **cantidad con flujo y UoM** (`numericFlow`), **origen→destino** (`sourceDest`), fecha, código, producto | icono por tipo de movimiento (`resolveStockMoveIcon`) | — | paginación en servidor; groupBy; analítica | `renderCard` + 9 columnas inline. |
| 29 | `inventory.inventorydocument` · `inventory/components/DocumentsClientView.tsx` | T C | código, fecha, estado, tipo (chip), referencia (`computed`) | — | — | paginación en servidor; groupBy | 1 `computed`. |
| 30 | Líneas del documento de inventario · `inventory/components/InventoryDocumentDrawer.tsx` | E | dinero, cantidad, referencia | — | — | — | 1 `computed`, 2 inline. |
| 31 | `inventory.inventorycount` · `inventory/components/InventoryCountClientView.tsx` | T C (maestro/detalle) | estado (habilita la edición), **progreso** del conteo, nº de diferencias | — | clic → selecciona conteo | groupBy | 9 columnas inline. |
| 32 | Líneas del conteo · ídem `:249` | E | código, producto, teórico, **contado (editable)**, **diferencia con signo y color**, UoM | — | **edición inline con persistencia inmediata** (`EditableQtyCell` `:43,:283`), solo en `IN_PROGRESS` | groupBy propio de líneas (`:503`) | `inventoryCountLineFields.ts` huérfano. |
| 33 | `inventory.stockreport` · `inventory/components/StockReport.tsx` | T C E | cantidades ×3, valorización | — | — | groupBy | También embebido en la analítica de producto. |
| 34 | `inventory.subscription` · `SubscriptionsClientView.tsx` | T C | contacto, dinero, próxima facturación, estado | — | acciones masivas | groupBy; `kpiCards` | Historial en modal con 3 KPI. |
| 35–40 | Maestros de inventario: `warehouse`, `uom`, `uomcategory`, `category`, `attribute`, `pricingrule` | T C | código, nombre, ratio, estado; categoría: **icono/color** (`computed`); atributo: **valores como tags** (`computed`); regla: tipo + monto/rango (inline) | — | acciones masivas (varios) | groupBy | **Casos triviales**: aun así, tablas inline (UoM, Warehouse) y `renderCard` pass-through. Categoría es jerárquica y se muestra **plana**. |
| 41 | `hr.employee` · `hr/components/EmployeeClientView.tsx` | T C (card por defecto) | contacto, sueldo, estado, 4 secundarios | **avatar** | — | — | — |
| 42 | `hr.absence` · `AbsenceClientView.tsx` | T C (`highlights`) | **rango de fechas** (dos campos), días, tipo (chip) | — | — | groupBy | Sin tipo rango. |
| 43 | `hr.payroll` · `PayrollClientView.tsx` | T C A | 6 montos, **3 estados** (liquidación, pago de remuneración, pago Previred) = estado multi-eje | — | clic → detalle | analítica | `PayrollCard.tsx:234` tabla cruda de haberes/descuentos (P6). |
| 44 | `hr.salaryadvance` · `SalaryAdvanceClientView.tsx` | T C | empleado + código (`computed`), monto, fecha, estado | — | — | `cardGroupBy` (deprecado, único consumidor) | — |
| 45 | `hr.payrollconcept` · `settings/components/HRSettingsView.tsx` | E | — | — | — | — | 4 columnas inline. |
| 46 | `settings.partner` · `settings/components/partners/PartnersClientView.tsx` | T C A | 7 montos (capital, utilidades, retiros), % de participación, **aviso "Exceso"** | — | — | analítica | 23 columnas inline. |
| 47 | Libro del socio · `settings/components/partners/PartnerLedgerDrawer.tsx` | E | **flujo de dinero** (`currencyFlow`), fecha + hora (`computed`) | — | — | — | 1 `computed`. |
| 48 | `settings.user` / `core.user` · `settings/components/UsersSettingsClientView.tsx` | T C | rol (chip), estado, grupos (**tags filtrados**, `computed`), avatar | **avatar** | — | paginación en servidor | Dos entradas de registro (RC7). |
| 49 | `settings.group` · `GroupsClientView.tsx` | T C | nº de miembros | — | — | — | Trivial. |
| 50 | `core.backgroundjob` · `app/(dashboard)/settings/jobs/JobsView.tsx` | T C | tipo, título, estado, **progreso**, datetime | **progreso** (card 100 % manual) | descargar resultado | — | Sin `*Fields`. |
| 51 | Registro de auditoría · `app/(dashboard)/settings/audit/AuditPageClient.tsx` | T | datetime, usuario, acción (icono + intent por tipo), entidad (referencia), origen | — | — | columnas ocultas (`hiddenColumns`) | Sin `*Fields`; 6 columnas inline. |
| 52 | `accounting.account` · `accounting/components/AccountsClientView.tsx` | **Tr** | código, tipo (chip), debe/haber/saldo | — | expandir/contraer árbol (`DataTableExpandHeader`) | `getSubRows` + `autoExpand` (consumidor único); groupBy | — |
| 53 | Mayor de cuenta · `app/(dashboard)/accounting/accounts/[id]/ledger/page.tsx`, `accounting/components/LedgerDrawer.tsx` | T E | debe/haber, **saldo acumulado**, fecha + hora, documento origen (referencia) | — | — | — | 7 columnas inline (página) frente a `ledgerMovementFields` (drawer): dos definiciones. |
| 54 | `accounting.journalentry` · `app/(dashboard)/accounting/entries/EntriesClientView.tsx` | T C | código, fecha, estado, monto, chip | icono según manual/reversa | clic → vista | paginación en servidor | `journalEntryFields` duplicado (TC-016). |
| 55 | `accounting.fiscalyear` / `tax.accountingperiod` · `accounting/components/closures/AccountingClosuresClientView.tsx:367` | vista propia | estado | cards de cierre (`renderCustomView`) | — | — | `cardComponent: 'custom'`. |
| 56 | `tax.taxperiod` · `tax/components/TaxDeclarationsClientView.tsx:267` | T + grilla propia | **mosaico de período** mes/año, montos, estado de pago derivado | grilla de períodos (`renderCustomView`) | — | — | 2 `computed`. |

### 3.3 Tesorería, finanzas, perfil

| # | Entidad · vista | Sup. | Valores | Card | Interacción | Colección | Dominio / escapes |
|---|---|---|---|---|---|---|---|
| 57 | `treasury.treasurymovement` · `treasury/components/TreasuryMovementsClientView.tsx:369` | T C A | código, tipo (estado), fecha, método, **origen→destino** (`sourceDest`), **monto con flujo** (`currencyFlow`) | **icono y color por tipo/castigo** (`:419-439`) | clic → `CashMovementDrawer`; acciones de fila | paginación en servidor que **pasa a cliente al agrupar, con tope de 200 y un toast** (`:53-58`); chip de prefijo inyectado a mano (`:390`); KPI de entradas/salidas | `renderCard`. |
| 58 | `treasury.bankmovement` · `treasury/components/BankMovementsClientView.tsx:78` | T C | igual que 57, acotado por banco | icono por movimiento | — | misma dualidad de paginación | `renderCard`. |
| 59 | `treasury.treasuryaccount` · `TreasuryAccountsClientView.tsx:133` | T C | nombre, tipo, **saldo con moneda por fila**, banco + proveedores (referencias múltiples) | icono por tipo de cuenta | `defaultAction` | groupBy | 1 `computed`. |
| 60 | `treasury.bank` · `BankCenterClientView.tsx:92` + secciones | T C + E | nombre, código, activo | **métricas de cuerpo** desde datos externos (`summary.total_accounts`) | secciones navegan por URL | — | Las secciones crean campos con `createEntityFields` **fuera de `*Fields`**. |
| 61 | `treasury.paymentmethod` · `PaymentMethodClientView.tsx:145` | T C | nombre, tipo, cuenta + chips Ventas/Compras | icono por tipo de método | `defaultAction` | — | 1 `computed`. |
| 62–63 | `treasury.terminalprovider` / `terminaldevice` · `PaymentHardwareClientView.tsx:158,:211` | T C ×2 | proveedor (**contacto como texto**), cuenta por cobrar, activo; serie, métodos (tags) | — | — | — | Dos colecciones en una página. |
| 64 | `treasury.terminalbatch` · `TerminalBatchesClientView.tsx:55` | T C | **rango de fechas de venta**, nº de transacciones, proveedor + método, neto, comisión, estado | — | — | — | 2 `computed`. |
| 65 | `treasury.check` · `treasury/checks/ChecksClientView.tsx:137` | T C + E | código, nº de cheque, vencimiento, monto, OV (referencia), estado | — | — | groupBy; acotado por banco/dirección (reutilizado embebido) | 1 `computed`. |
| 66 | `treasury.bankloan` · `treasury/loans/LoansClientView.tsx:119` | T C | prestamista, **moneda como texto**, capital, saldo, tasa y plazo (texto), **próximo vencimiento como texto** | — | `defaultAction` | — | **Pd-backend** (tipos como texto). |
| 67 | Cuotas del préstamo · `treasury/loans/LoanDetailModal.tsx:244` | E | capital, interés, otros, total, **saldo acumulado** (tabla de amortización); fila sintética de comisión antepuesta; KPI "Cuotas pagadas n/m" | — | pagar/ver por cuota | — | 11 columnas inline; `loanRegisterFields.ts` sin uso. |
| 68 | `treasury.creditline` · `credit-lines/CreditLinesClientView.tsx:76` | T C | límite, usado, disponible, **utilización como texto "%"** (debería ser progreso) | — | — | — | — |
| 69 | `treasury.cardstatement` · `card-statements/StatementsClientView.tsx:142` | T C A | tarjeta, período (texto), facturado, corte, vencimiento (texto), estado, pagado en (datetime) | — | `defaultAction` | analítica grande (deuda, no facturado, vencido) | `renderCard`. |
| 70 | Cargos del estado de cuenta · `card-statements/StatementDetailModal.tsx:129` | E | descripción multilínea por origen, **cuota n/m**, monto, tipo | — | — | modelo de fila **fusionado** desde movimientos, cuotas y cargos pendientes | 2 `computed`. |
| 71 | `treasury.unbilledcharge` · `card-statements/UnbilledChargesClientView.tsx:331` | T C A | tipo, fecha, **cuota n/m**, monto, compra asociada (referencia + estado) | — | `onRowClick` | KPI (límite, % usado, cuotas próximas) | tabla inline, card por Fields. |
| 72 | `treasury.bankstatement` · `finance/bank-reconciliation/components/StatementsClientView.tsx:287` | T C | saldos de apertura (atenuado) y cierre, líneas + conciliadas (compuesto), **progreso de conciliación**, estado | **card propia con pie** sobre `EntityCard` (`:201-251`) | confirmar (bloquea) | — | 2 `computed`. |
| 73 | Líneas de cartola · `finance/bank-reconciliation/components/StatementDetailPanel.tsx:311` + `app/(dashboard)/treasury/reconciliation/[id]/page.tsx:382` | E T | #, fecha, descripción, cargo, abono, **saldo por línea**, estado; resumen con totales de flujo y progreso | — | — | totales calculados en cliente **fuera de la tabla** | **Dos copias casi idénticas**. |
| 74 | Conciliación · `finance/bank-reconciliation/components/ReconciliationPanel.tsx` (1491 líneas) | **2 T lado a lado** | chip cargo/abono, montos con flujo, sugerencias | grupos conciliados como cards con diferencia | **selección dual + arrastrar y soltar para emparejar**; sugerencias resaltadas; excluidas en gris | paginación en servidor independiente por tabla | `renderRow` + `cloneElement`, checkbox a mano, casts `as unknown as`; ~10 inline. Caso **específico**. |
| 75 | `accounting.budget` · `finance/components/BudgetsClientView.tsx:122` | T C | nombre (referencia propia), período | — | — | — | 1 `computed`. |
| 76 | Partidas del presupuesto · `finance/components/BudgetDetailView.tsx:164` | E | **ejecución en %** (`DataCell.Progress`), presupuestado/real/varianza | — | — | KPI; **CSV a mano** | — |
| 77 | Varianza de presupuesto · `finance/components/BudgetVarianceTable.tsx:167` | **R Tr** | real/presupuesto/varianza por mes y acumulado; varianza favorable/desfavorable con color | — | expandir/contraer | sangría por nivel, nivel 0 en negrita | Tabla cruda recursiva (P4). |
| 78 | Flujo de caja · `finance/components/CashFlowTable.tsx` | R | secciones, filas de total, período de comparación, chip cuadrado/descuadre | — | — | subtotales por sección | `ReportTable` + 2 tablas crudas. |
| 79 | Reglas de mapeo · `finance/components/MappingConfigDrawer.tsx:306` | E | — | — | `bulkDock` (consumidor único) | groupBy | 5 inline. |
| 80 | Liquidaciones en el perfil · `profile/components/ProfileView.tsx:603` | E X | folio, período, haberes/descuentos (flujo), neto, pago | — | expansión → **subtabla** de pagos (`:615`) | — | 11 inline; `toolbarClassName`, `noBorder`. |
| 81 | Transacciones del socio (perfil) · `profile/components/PartnerProfileTab.tsx:226` | E | **saldo acumulado calculado en cliente** (`:49-55`), montos | — | acciones de fila | KPI + gráfico | `formatCurrency` en línea. |
| 82 | Proveedores de terminales en POS · `treasury.terminal` | (ver #8) | — | — | — | — | — |

## 4. Caso de uso específico: colecciones editables en wizards y modales

> Decisión del usuario (2026-10-17): entran en el alcance como caso de uso propio.
> **Corrección de la Fase 1:** `treasury/card-statements/BillChargesModal.tsx:232` **no es editable** (la tabla no contiene ningún input; V). Es un resumen agrupado por compra y expandible, con subtotal por grupo → pasa a P5. P2 queda con **4** ubicaciones.

### 4.1 P1 · Cantidad a procesar por línea (7)

| Archivo:línea | Origen de filas | Celdas editables | Tope | Valor inicial | Estado | Validación y feedback |
|---|---|---|---|---|---|---|
| `sales/components/DeliveryDrawer.tsx:427` | líneas de la OV (fijas) | cantidad (step 0,01) | `max = quantity_pending`, solo HTML (`:511`, V) | = pendiente | `useState` línea→cantidad | columna de estado por fila; alerta de despacho parcial; toasts al enviar (stock, producción) |
| `sales/components/checkout/Step3_Delivery.tsx:173` | líneas físicas | cantidad + **teclado numérico táctil** | `max = pendingQty` | 0 | estado del wizard (upsert por línea) | fila deshabilitada con motivo ("Requiere producción") |
| `purchasing/components/ReceiptModal.tsx:286` | líneas de la OC | cantidad + **costo unitario** | `max = quantity_pending` | = pendiente (redondeado hacia arriba) | 2 `useState` | chip Completo / Parcial / Excede pendiente; "al menos una" |
| `purchasing/components/checkout/Step4_Receipt.tsx:231` | líneas de la OC | cantidad + **UoM por fila** | `max = pendingQty` | = pedido | estado del wizard | validación del paso; segunda subtabla de fecha por fila (`:284`) |
| `billing/components/checkout/Step2_Logistics.tsx:228` | ítems elegidos en el paso anterior | cantidad | `max = itemQty` | 0 | estado del wizard | deshabilitada si no es elegible |
| `orders/components/NoteLogisticsModal.tsx:174` | líneas de la factura | cantidad (`Input` sin min/max) | **recorte en JS** (`Math.min`, `:87`) | 0 | `useState` **por `product_id`** | deshabilitada si pendiente ≤ 0; "al menos una" |
| `billing/components/checkout/Step1_Items.tsx:87` | líneas + **checkbox que habilita la edición** | cantidad, precio, motivo | tope variable (entregado / stock / fabricable / 999999), recorte en JS | vacío | `selectedItems[]` del padre | badge "MAX n" en el input; precio deshabilitado en NC |

**Contrato común P1:**
- Filas fijas derivadas de un documento origen, con clave de fila estable.
- Columnas de contexto de solo lectura: producto (con línea secundaria), pendiente u ordenado, unidad.
- Una celda numérica editable por fila: `min 0`, `max` = pendiente (o un tope derivado por fila), paso decimal o entero según la UoM.
- Predicado de elegibilidad por fila: deshabilita, atenúa y muestra el motivo.
- Salida `[{ line_id, product_id, quantity, uom }]`; validación "nada que procesar"; estado derivado "parcial".
- Densidad de wizard (inputs `h-8`, anchos fijos).

**Variaciones P1:**
- Valor inicial: pendiente o 0.
- Cómo se aplica el tope: solo HTML (4), recorte en JS (2) o solo un chip de estado (1). **Ningún archivo muestra un error junto a la celda.**
- Celdas extra: costo, UoM, precio, motivo.
- Contexto extra: stock coloreado, estado de OT, chips de procesado y pendiente.
- Selección que habilita la edición (Step1, `NoteStep_LineItems`).
- Teclado táctil (Step3).
- Columna de estado por fila (Delivery, Receipt).

**Ausente en los 7:**
- Acciones "procesar todo" / "limpiar".
- Pie de totales.
- Estado vacío.
- Agrupación.
- **Etiqueta accesible por input**: `LabeledInput` acepta `label` (`components/shared/LabeledInput.tsx:12`), pero las celdas no lo pasan (V en `DeliveryDrawer.tsx:508-516`).

**Relacionados:**
- `inventory/components/InventoryCountClientView.tsx:43`: `EditableQtyCell`, edición inline con **persistencia inmediata por celda**, no por lote.
- `notes/components/steps/NoteStep_LineItems.tsx`: `<DataTable>` con checkbox, cantidad y motivo editables (`:264`, `:419`). Mismo contrato que Step1, pero dentro del sistema.

### 4.2 P2 · Reparto de montos contra un tope (4)

| Archivo:línea | Filas | Celdas editables | Regla | Estado | Resumen | Ayudas |
|---|---|---|---|---|---|---|
| `settings/components/partners/CreateDistributionFlow.tsx:343` | líneas del borrador (fijas) | 3 montos: dividendo, reinversión, retenido | Σ por fila = \|neto\|; columna "Diferencia" por fila | `useState` | diferencia por fila; las columnas cambian según el modo (utilidad/pérdida); una fila puede colapsar en un mensaje (`colSpan`) | — |
| `settings/components/partners/MassPaymentWizard.tsx:118` | socios con dividendos pendientes | 1 monto | ≤ pendiente; borde rojo | `useState` | total en la cabecera | **"Pagar totalidad"** (`:105`) y **"Limpiar todo"** (`:112`), V; fila de estado vacío |
| `settings/components/partners/MobilizeEarningsWizard.tsx:124` | socios con utilidades retenidas | 2 montos | Σ ≤ disponible; borde rojo en ambas | `useState` | totales en la cabecera | estado vacío |
| `finance/bank-reconciliation/components/SplitAllocationDialog.tsx:151` | **dinámicas** (añadir/quitar) | factura (`Select`), notas, monto | Σ = monto del pago (con tolerancia) | **RHF `useFieldArray` + zod**, `FormMessage` por celda | total y diferencia coloreada (ok/aviso/destructivo) | añadir con el resto prellenado; quitar |

**Contrato común P2:**
- Filas con un monto disponible o tope, y de 1 a N celdas de dinero editables.
- Regla por fila (`Σ ≤ tope` o `Σ = objetivo`), con estado de error por fila y un `isValid` agregado para el paso del wizard.
- Totales por columna y total general; resto o diferencia por fila o global, coloreado por estado.
- Ayudas opcionales "llenar hasta el tope" / "limpiar".
- Filas dinámicas opcionales (con el resto prellenado) y celda de referencia (selector).
- Fila de estado vacío.

**Variaciones P2:**
- Tope por fila o global.
- Columnas condicionales según el modo.
- `useState` (3) frente a RHF + zod (1, el único alineado con la invariante #9).

**Ausente:** ningún caso tiene etiqueta accesible por input ni `<tfoot>` real (los totales viven en la cabecera).

### 4.3 Requisitos que se derivan (para la Fase 4)

| Req. | Descripción | P1 | P2 | Otros |
|---|---|---|---|---|
| ED-1 | Celda editable tipada (número con min/max/step, dinero, select, texto, fecha), con etiqueta accesible derivada de la fila | 7 | 4 | InventoryCount, NoteStep, variantes |
| ED-2 | Tope y regla por fila declarativos, con error visible junto a la celda | 7 | 4 | — |
| ED-3 | Predicado de elegibilidad por fila (deshabilitar + motivo) | 4 | — | — |
| ED-4 | Pie de totales y diferencia declarativo (`<tfoot>`) | — | 4 | líneas de documento, LdM, cartola, presupuesto, haberes |
| ED-5 | Ayudas masivas ("procesar todo", "limpiar", "llenar hasta el tope") | 0 (ausente; útil) | 1 | — |
| ED-6 | Integración con RHF (`useFieldArray`) y zod, por la invariante #9 | 0 | 1 | — |
| ED-7 | Filas dinámicas (añadir/quitar) | — | 1 | `PurchaseOrderModal` (P3, ×2), `FormLineItemsTable` |
| ED-8 | Dos modos de persistencia: por lote (submit del wizard) y por celda (commit inmediato) | lote | lote | InventoryCount = celda |
| ED-9 | Densidad de wizard y modo táctil | 7 | 4 | POS |

## 5. Matriz agregada de requisitos

Clase: **C** = común (debe salir sin configuración) · **F** = frecuente (configuración declarativa) · **E** = específico (extensión por entidad). Cobertura actual: **sí** · **escape** (se logra con `computed`, `renderCard`, columna inline, tabla cruda o cast) · **no**. Los conteos se hacen sobre los 82 contextos del §3 y son aproximados (±2); cada uno lista sus entidades.

### 5.1 Tipos de valor

| Requisito | Nº | Entidades (ejemplos, # del §3) | Cobertura | Clase |
|---|---|---|---|---|
| Estado simple | ~60 | casi todas | sí (`status` + `StatusBadge`) | C |
| Fecha | ~55 | casi todas | sí | C |
| Código / folio | ~55 | casi todas; con prefijo DTE en 3–4 | sí; prefijo DTE con `get` | C |
| Dinero con moneda | ~45 | documentos, crédito, tesorería, RR. HH., socios | sí; moneda por fila solo en #59; préstamos guardan la moneda como texto (Pd-backend) | C |
| Dato ausente y alineación numérica | todas | — | sí | C |
| **Referencia a entidad o documento** (con texto de respaldo) | ~28 | líneas #10–15, #17–18, #20, #22–23, #29–30, #51, #53, #65, #71, #75, #59 | **escape** (20 `computed` + inline); solo `contact` y `sourceDest` son nativos | **F** |
| Contacto enlazado | ~12 | #1, #5, #17, #19, #34, #41; como **texto** en #2–4 y #62 | parcial | F |
| Dinero con flujo (entrada/salida o signo) | ~12 | #18, #47, #57–58, #73–74, #80; NC/ND #3–4 sin signo; mayor #53 | sí en esquema (`currencyFlow`); escape inline; **no** en NC | F |
| Cantidad + UoM | ~12 | #10–15, #23, #25, #28, #32–33 | sí (`number.suffix`, `numericFlow.unit`); escape en wizard | F |
| Estado multi-eje (hub) | 6 | #1–4, #22 (estado + etapa + tercerización + atraso), #43 (3 estados) | escape (`computed` + columnas ocultas para facetas) | F |
| Valor compuesto (principal + secundario) | ~14 | #5, #16, #24, #44, #59, #61, #64, #70, #72, workflow #1–2 | escape | F |
| Tags múltiples | ~7 | #5, #8, #39, #48, #63, #61 | sí (`chip-category`); escape cuando hay filtro (#48) | F |
| Progreso (valor respecto de un total) | ~8 | #50, #72, #76, #31, #68 (como texto), #10 (entregado/facturado), #16 (usado/límite) | escape o no | F |
| Rango de fechas | ~6 | #7, #42, #64, #34; vencimiento #22 | **no** (dos campos o `computed`) | F |
| Datetime | ~6 | #7, #51, #50, #69; fecha + hora de dos campos en #47, #53 | sí (`dateTime`); escape con dos campos | F |
| Saldo acumulado | 4 | #53, #67, #73, #81 | **no** (llega del backend o se calcula en la vista) | F |
| Cuotas n/m | 4 | #67, #70, #71, `BillChargesModal` | escape | F |
| Vencido / días de atraso | 3 | #18, #22, #16 | escape | F |
| Icono o color por fila (en la celda) | ~5 | #38, #51, #22 (etapa), #26 | escape | F |
| Miniatura / avatar | 4 | #26 (imagen), #5, #41, #48 | escape (`renderCard`) | E |
| Visual de dominio (mosaico de período, matriz de variantes, resumen de atributos, descripción multilínea) | ~5 | #56, #27, #39, #70, disponibilidad #26 | escape | E |
| Color / CMYK como dato | 0 | — | n/a (**hipótesis descartada**, V) | — |

### 5.2 Superficies y layout

| Requisito | Nº | Entidades | Cobertura | Clase |
|---|---|---|---|---|
| Tabla + card con una sola definición | 54 en el registro (45 + 9) | maestros, documentos, tesorería | sí en tabla; card con **escape** en 43 (`renderCard`) | **C** |
| Card: icono o color de icono por fila | ~10 | #1–3, #28, #54, #57–59, #61 | escape (`renderCard` / `cardConfig` en el registro) | F |
| Card: media (imagen o avatar) | 4 | #5, #26, #41, #48 | escape | E |
| Card: métricas o cuerpo desde datos externos o progreso | 3 | #60, #50, #72 (card propia con pie) | escape | E |
| Card: cuerpo de workflow (líneas/total/pendiente) | 3 (`cardVariant: 'workflow'`) | #1, #2, #3 | P: lo resuelve `cardConfig.workflow` del registro; el campo `workflow` es solo de tabla | F |
| Lista embebida en drawer o ficha (minimal/embedded) | ~25 | líneas, sublistas, libros, secciones de banco | sí (variantes `minimal`/`embedded`), pero con 9 archivos que reescriben el orden (`placement`) y varias tablas crudas | **C** |
| Orden de columnas explícito, independiente de la card | ~25 (todas las embebidas) | #10–15, #18, #20, #30 | **escape** (43 `placement: 'detail'`) | **C** |
| Árbol o jerarquía | 4 | #52 (sí), #77 (crudo), #78 (`ReportTable`), #38 (se muestra plano) | parcial | E |
| Reporte con subtotales por sección y columnas agrupadas | 2–3 | #77, #78 | escape | E |
| Kanban | 1 | #22 (OT) | escape (`renderCustomView`); OV declara `surfaces: ["card","kanban"]` en un campo sin kanban en el registro | E |
| Timeline | 1 | #22 | escape | E |
| Vista personalizada (grilla de períodos, cards de cierre, detalle de stock) | 3 | #55, #56, #26 | escape (`renderCustomView`) | E |
| Dos colecciones coordinadas (emparejamiento) | 1 | #74 | escape (`renderRow` + `cloneElement`) | E |

### 5.3 Interacciones

| Requisito | Nº | Entidades | Cobertura | Clase |
|---|---|---|---|---|
| Clic → ficha o drawer (acción por defecto) | ~70 | casi todas | sí, pero **cableado por vista** (25 `defaultAction`, 25 `onClick`, 16 `openEntity`, `toggleSelection` en documentos) | **C** |
| Acciones de fila | ~45 | maestros, tesorería, OT | sí (`createEntityActions`) | C |
| Selección con acciones masivas | 7 | #22, #26, #34, #35–39 | escape (columna de checkbox a mano en 4 vistas) | F |
| Selección única con panel (hub) | 5 | #1–4, #31 | sí (`toggleSelection` + `hubTrigger`) | F |
| Fila expandida (subcomponente o subtabla) | 4 | #16, #19, #80, árbol #52 | sí (`renderSubComponent`) | F |
| Edición inline con persistencia inmediata | 1 | #32 | escape (`EditableQtyCell`) | E |
| Edición por lote (wizard/modal) | 11 + 2 | P1 ×7, P2 ×4, `NoteStep`, `PurchaseOrderModal` | **no** (tablas crudas) | **F** (caso de uso propio, §4) |
| Arrastrar y soltar para emparejar | 1 | #74 | escape | E |

### 5.4 Comportamiento de colección

| Requisito | Nº | Entidades | Cobertura | Clase |
|---|---|---|---|---|
| Búsqueda y filtros facetados | 56 vistas · 38 configuraciones | casi todas | sí (`UnifiedSearchBar`) | C |
| Estados vacío (con o sin filtro), carga y refetch | todas | — | sí (`resolveEmptyState`, skeletons) | C |
| Agrupación | 31 vistas · 25 configuraciones | maestros, documentos, tesorería | sí, **pero desactiva la paginación en servidor (tope de 200)** en #1, #22, #57–58 | C |
| Paginación en servidor con `rowCount` | 12 | #1–2, #22, #26, #28–29, #48, #54, #57–58, #74 | sí (props cableadas a mano con boilerplate) | F |
| Columnas ocultas u opcionales | ~4 | #51, #2 (facetas), PartnerLedger | sí (`hiddenColumns`); escape para facetas | F |
| Modos que cambian de entidad o de conjunto de campos | 4 | #1, #2, #6, #16 | **escape** (ternarios; card de notas sin `fields`) | F |
| Pie de totales | ~10 | #10–11, #25, #73, #76, #43/`PayrollCard`, P2, #53 | **no** (calculado fuera de la tabla o en línea) | F |
| Panel de analítica / KPI | 9 (registro) + ~6 ad hoc | #1–2, #26, #28, #43, #46, #57, #69, #71 + #22, #34, #67, #76, #81 | sí (`analyticsPanel`); escape (`StatCard` ad hoc) | F |
| Exportación | 1 | #76 (CSV a mano) | **no** | E (P: pendiente de confirmar si es requisito) |

### 5.5 Síntesis por clase

| Clase | Requisitos | Cobertura hoy |
|---|---|---|
| **C · Común (sin configuración)** | estado, fecha, código, dinero, dato ausente, alineación; tabla + card con una definición; lista embebida; **orden de columnas explícito**; clic → ficha; acciones de fila; búsqueda y facetas; estados; agrupación | Mayormente **sí** en valores; **escape** en card (43 `renderCard`), orden de columnas (43 overrides) y acción por defecto (cableado por vista); agrupación con limitación de paginación |
| **F · Frecuente (declarativo)** | **referencia**, contacto, flujo, cantidad + UoM, estado hub, compuesto, tags, progreso, rango, datetime, saldo acumulado, cuotas n/m, vencido; icono o color por fila en card y celda; workflow en card; selección masiva; expansión; paginación en servidor; modos; **pie de totales**; analítica; **edición por lote en wizard/modal** | Mayoría **escape** o **no**: es la franja donde está la rigidez |
| **E · Específico (extensión por entidad)** | media en card, visuales de dominio, árbol/reporte, kanban/timeline de OT, vistas propias (períodos, cierres), conciliación con arrastre, edición inline por celda, exportación | **escape**: debe resolverse con extensión tipada **dentro de la feature** |

## 6. Particularidades de dominio de imprenta

| Particularidad | Dónde | Implicación para el sistema |
|---|---|---|
| **Etapas de producción** con icono, color y carriles (kanban) | #22, `features/production/components/WorkOrderKanban.tsx:106-124` | Tipo `stage` (enum con metadatos) y superficie kanban declarativa agrupada por un campo |
| **Tercerización** parcial/total por OT | #22 | Estado multi-eje |
| **Atraso** de OT (`isWorkOrderOverdue`) | #22 | Variante por predicado sobre el estado; filtro asociado |
| **Asignación de materiales** con aviso "sin materiales" | #22, #23 | Avisos por fila en card de kanban; colección editable en wizard |
| **OT vinculada a la línea de OV** | #10 | Referencia a documento en lista embebida |
| **"Requiere producción"** como motivo de no elegibilidad al despachar o facturar | P1 (Step3, Step2) | Predicado de elegibilidad por fila (ED-3) |
| **Rendimiento de LdM** con UoM; costo de LdM | #24–25 | Cantidad + UoM; pie de totales |
| **Matriz de variantes** de producto | #27 | Visual de dominio (E) |
| **Precio dinámico** por reglas | #26, #40 | Variante por predicado en dinero |
| **Detalles de fabricación** en checkout | `sales/components/checkout/Step2_ManufacturingDetails.tsx` (5 inline) | Colección editable (revisar en la Fase 3 si es formulario) |
| **Tipos DTE** (factura, boleta, NC, ND) y folio con prefijo; NC con signo | #3–4, notas en #1–2 | Código con prefijo; dinero con signo según el tipo de documento |
| CMYK como dato | — | **No aparece** en colecciones (V). Se descarta como requisito de este sistema |

## 7. Hallazgos nuevos de esta fase (añadidos al ledger)

| ID | Hallazgo | Evidencia | Causa raíz |
|---|---|---|---|
| TC-018 | La card de notas recibe `fields = undefined as unknown as …` | `features/sales/components/SalesOrdersView.tsx:380` (V) | RC5, RC8 |
| TC-019 | Agrupar desactiva la paginación en servidor (tope de 200 filas, con un toast) | `features/treasury/components/TreasuryMovementsClientView.tsx:53-58`; patrón `manualPagination={!effectiveGrouping}` en OV y OT | RC6 (P en su origen: depende de si el backend puede agrupar, **Pd-backend**) |
| TC-020 | Política de vista declarada y no usada (4 entidades `list+card` sin lista; OV con `surfaces: ['kanban']` sin kanban; dos entradas de registro por terminal POS y por usuario) | §2; `features/sales/salesOrderFields.tsx:50` | RC7 |
| TC-021 | Duplicados de vista: líneas de cartola (`StatementDetailPanel.tsx` frente a `reconciliation/[id]/page.tsx`); mayor de cuenta (página inline frente a `ledgerMovementFields`); `loanRegisterFields.ts` sin uso | §3 #53, #67, #73 | RC5, RC7 |
| TC-022 | Inputs de colecciones editables sin etiqueta accesible | `features/sales/components/DeliveryDrawer.tsx:508-516` (V); patrón en los 11 P1/P2 | Requisito ED-1 (a11y, Fase 3) |
| TC-023 | **Pd-backend**: préstamos con moneda, tasa, plazo y próximo vencimiento como texto; saldos acumulados calculados en cliente en `PartnerProfileTab.tsx:49-55` | §3 #66, #81 | — |

## 8. Verificación

| Afirmación | Cómo |
|---|---|
| Cifras del §1 | Comandos de la tabla del §1 |
| Fichas | Tres barridos `Explore`; `archivo:línea` aportados por los barridos |
| Card de notas sin `fields` | Lectura de `SalesOrdersView.tsx:374-384` |
| `BillChargesModal` no editable | `sed -n '232,260p' … \| grep -c "<(Input\|LabeledInput)"` → 0; los `LabeledInput` (`:288-330`) son campos de cabecera |
| Inputs P1 sin `label` | Lectura de `DeliveryDrawer.tsx:505-516` |
| Ayudas de `MassPaymentWizard` | `grep -n "Pagar Totalidad\|Limpiar Todo"` → `:105`, `:112` |
| CMYK solo como adorno | `grep -rn CmykRing` → checkbox, `RadioCard` y el indicador de carga de `DataTable` |
| No se ejecutaron tests | No aplica en esta fase |
