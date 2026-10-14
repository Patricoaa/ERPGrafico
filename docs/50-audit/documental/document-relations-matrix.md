# Matriz de relaciones documentales — Fase 2

> Entregable 2a · 2026-10-14 · Complementa [documents-inventory.md](./documents-inventory.md).
>
> **Evidencia**: **C** = confirmado en código · **E** = confirmado por ejecución (test en BD efímera) · **D** = observado en datos del dev server (`192.168.1.93`, datos demo, consultas SELECT) · **I** = inferido · **NV** = no verificable.
> **Uso real (D)**: conteo en dev server; "0" puede significar flujo no ejercitado en los datos demo, no que no funcione.
>
> Semántica: **DER** derivación · **CUM** cumplimiento · **REF** referencia · **LIQ** liquidación · **CON** contabilización · **COR** corrección/reversión · **ASO** asociación.
> Persistencia: **FK**, **O2O**, **GFK** (ContentType), **PGFK** (string+int sin integridad), **TXT** (texto libre), **JSON**, **CALC** (solo calculada).

## 1. Ciclo de venta

| # | Origen → Destino | Sem. | Card. | Granul. | Persistencia | Creación | Consulta / UI | Evidencia |
|---|---|---|---|---|---|---|---|---|
| R1 | SaleOrder → SaleDelivery | CUM | 1:N, parcial | doc + línea (`SaleDeliveryLine.sale_line` PROTECT) | FK `SaleDelivery.sale_order` (`sales/models.py:555`) | `SalesService.dispatch_order` (`sales/services.py:177`), entregas parciales (`:477`) | `SaleOrderSelector.get_related_documents["deliveries"]` (`sales/selectors.py:104`); Order Hub LogisticsPhase | C; D 128 confirmados |
| R2 | SaleLine → SaleLine.quantity_delivered (acumulado de cumplimiento) | CUM | — | línea | campo agregado (`sales/models.py:376`) | **solo** `sales/services.py:710`, en rama `else` (sin detalles inventariables) y sobre la última `line` del bucle | `quantity_pending`, `_update_order_delivery_status` (`:766`) | C; **E** (0 tras confirmar); **D** 107/132 líneas de OV DELIVERED con 0 |
| R3 | SaleDeliveryLine → StockMove | CUM (logística) | 1:1 | línea | O2O `stock_move` (`sales/models.py:652`) | emparejado por `(product_id, -qty)` (`sales/services.py:686-703`); los moves se crean con `abs(qty)` (`inventory/services.py:175`) → nunca empareja | `inventory/selectors.py:433`, `billing/selectors.py:99` | C; **E**; **D 83/83 nulos**; el test `sales/tests/test_p24_confirm_delivery.py:111` afirma `stock_move is None` |
| R4 | SaleDelivery → InventoryDocument | DER (técnica) | 1:1 esperado | doc | PGFK `source_document_type="sales.saleorder"` **apunta a la OV, no al despacho** (`sales/services.py:586`) | `confirm_delivery` | ninguna directa | C; D 103 docs con origen `sales.saleorder` |
| R5 | InventoryDocument → StockMove | DER | 1:N | línea (detalle) | **TXT** en `StockMove.description` (`inventory/services.py:179`); sin FK en `InventoryDocumentDetail` | `InventoryService.confirmar_documento` | no resoluble | C; D 126/140 moves sin back-link tipado |
| R6 | SaleOrder → Invoice (FACV/BOL) | DER | 1:N | **doc** (sin líneas propias) | FK legacy `Invoice.sale_order` (`billing/models.py:89`) + GFK `source_order` (`:86`) **no escrito por ningún servicio** | `BillingService` (`billing/services.py:456`), `core/services/__init__.py:107` | `get_related_documents["invoices"]`; `InvoiceSelectorExt.get_lines` = todas las líneas de la OV (`billing/selectors.py:75`) | C; **D 168/168 `source_order` NULL** |
| R7 | SaleOrder/SaleLine → WorkOrder | DER | 1:N; línea 1:N | doc + línea | FK `WorkOrder.sale_order`, `sale_line` (`production/models.py:56,65`) | `WorkOrderService` (`production/services.py:119,225,326`) | `SaleOrderSerializer.get_work_orders` (`sales/serializers.py:289`); Order Hub ProductionPhase | C |
| R8 | SaleDeliveryLine → WorkOrder (OT exprés) | DER | N:1 | línea | FK `SaleDeliveryLine.work_order` (`sales/models.py:661`) | `create_ot_for_delivery_line` (`sales/services.py:564`) | NV | C |
| R9 | SaleOrder → SaleReturn | COR (logística) | 1:N | doc; **líneas sin FK a línea origen** (`SaleReturnLine`) | FK `SaleReturn.sale_order` (`:716`) | `SalesReturnService` (`sales/return_services.py`) | NV | C; D 0 registros |
| R10 | Invoice(NC) → SaleReturn / PurchaseReturn | COR | 1:N | doc | FK `credit_note` (`sales/models.py:731`, `purchasing/models.py:518`) | `note_checkout_service.py:116-133` | `billing/selectors.py:121-124` | C; D 0 |
| R11 | Invoice(ND) → SaleDelivery / PurchaseReceipt | DER | 1:N | doc | FK `related_note` (`sales/models.py:568`, `purchasing/models.py:383`) | `note_checkout_service.py:137-155` | `get_related_documents` excluye despachos con nota (`sales/selectors.py:105`) | C; D 0 |
| R12 | Invoice(NC/ND) → SaleLine / PurchaseLine | DER | 1:N | línea | FK `related_note` en la **tabla de líneas de la OV** (`sales/models.py:421`, `purchasing/models.py:311`) | flujo de notas | `get_lines` filtra `related_note IS NULL` (`sales/serializers.py:286`) | C |
| R13 | Invoice(NC/ND) → Invoice corregida | COR | N:1 | doc | FK `corrected_invoice` (`billing/models.py:95`), **opcional** en flujo legacy (`sales/services.py:1105`) | NoteWorkflow + legacy `create_note` | `adjustments` en `billing/selectors.py:93` | C; D 0 notas |
| R14 | NoteWorkflow → Invoice/OV/OC | ASO (proceso) | 1:1 / N:1 | doc; ítems en **JSON** | O2O/FK + JSON `selected_items` | `note_checkout_service.py:204,1063` | Hub de notas | C |

## 2. Ciclo de compra

| # | Origen → Destino | Sem. | Card. | Granul. | Persistencia | Creación | Consulta / UI | Evidencia |
|---|---|---|---|---|---|---|---|---|
| R15 | PurchaseOrder → PurchaseReceipt | CUM | 1:N parcial | doc + línea (`PurchaseReceiptLine.purchase_line`) | FK (`purchasing/models.py:367,418`) | `PurchasingService` (`purchasing/services.py`) | Order Hub | C |
| R16 | PurchaseLine.quantity_received | CUM | — | línea | agregado, `+=` en `purchasing/services.py:499,624,711` | — | `receiving_status` | C (patrón correcto, contraste con R2) |
| R17 | PurchaseReceiptLine → StockMove | CUM | 1:1 | línea | O2O (`:441`) | `purchasing/services.py` | `inventory/selectors.py:437` | C; D 21/34 nulos |
| R18 | PurchaseOrder → Invoice (FACC) | DER | 1:N | doc | FK `Invoice.purchase_order`; GFK no escrito | `billing/services.py:597` | `get_lines` = líneas OC | C; D |
| R19 | WorkOrder → PurchaseOrder; WorkOrderMaterial → PurchaseLine | DER (tercerización) | 1:N / N:1 | doc / línea | FK (`purchasing/models.py:98`, `production/models.py:400`) | `purchasing/services.py:181,271`; emparejado por producto si no hay id (`:244,333`) | NV | C |
| R20 | PurchaseOrder → PurchaseReturn | COR | 1:N | doc, sin FK de línea | FK (`:500`) | `purchasing/return_services.py` | — | C |

## 3. Pagos y liquidación

| # | Origen → Destino | Sem. | Card. | Persistencia | Creación | Consulta | Evidencia |
|---|---|---|---|---|---|---|---|
| R21 | TreasuryMovement → Invoice / SaleOrder / PurchaseOrder | LIQ | N:1 por FK (un movimiento puede tener **invoice y sale_order a la vez**) | FK legacy (`treasury/models.py:209-221`) | `PaymentOrchestrator` (`treasury/orchestrator.py:151`); anticipos reasignados `payment.invoice = invoice` (`billing/services.py:539,708`) | `Invoice.payments`, `SaleOrder.payments`, `get_related_documents["payments"]` | C; D 127/248 con ambos |
| R22 | TreasuryMovement → cualquiera | LIQ | N:1 | GFK `allocated_to` (`:202-206`) | **ningún escritor** | leído como fallback en `treasury/services.py:290,346,430` | C; D 0 |
| R23 | TreasuryMovement → N documentos | LIQ (split) | 1:N con importe | `PaymentAllocation` (`:2343`) | `AllocationService.allocate` (`treasury/allocation_service.py:43`), solo desde endpoint (`treasury/views.py:493`) | `get_pending_amount` de factura suma FK + allocations (`billing/serializers.py:82`) | C; D 0 filas |
| R24 | Check → Invoice / SaleOrder; Check → TreasuryMovement (recepción/liquidación) | LIQ | N:1 / 1:1 | FK/O2O (`treasury/models.py:2540-2566`) | `PaymentOrchestrator._handle_check` | CheckDrawer | C |
| R25 | TreasuryMovement → BankStatementLine / ReconciliationMatch | LIQ (conciliación) | N:1 | FK (`:253,261`) + `PaymentAllocation.bank_statement_line` | matching service | Workbench conciliación | C |
| R26 | TerminalBatch → TreasuryMovement (pagos) / supplier_invoice / settlement | LIQ | 1:N | FK (`:320`, `:2087`, `:2098`) | treasury | TerminalBatchDrawer | C |
| R27 | TreasuryMovement → Payroll | LIQ | N:1 | FK `payroll` (`:228`) | hr/treasury | — | C |

## 4. Contabilización

| # | Origen → Destino | Sem. | Card. | Persistencia | Evidencia |
|---|---|---|---|---|---|
| R28 | Documento → JournalEntry (dirección doc→asiento) | CON | 1:1 | O2O `journal_entry` en OV, OC, despacho, recepción, devoluciones, factura, movimiento tesorería, F29, POSSessionAudit; FK (N:1) en StockMove, SalaryAdvance, PayrollPayment, PartnerTransaction; dos O2O en Payroll | C |
| R29 | JournalEntry → Documento (dirección asiento→doc) | CON | N:1 | GFK `source_document` (`accounting/models.py:435-439`), seteado en ~29 de 45 puntos de creación | C; D 21 asientos automáticos sin origen; 0 colgantes |
| R30 | JournalEntry → JournalEntry | COR | N:1 | FK `reversal_of` (`:441`) | C |
| R31 | FiscalYear → JournalEntry apertura/cierre | CON | 1:1 ×2 | O2O | C |
| R32 | BankStatementLine → JournalEntry diferencia | CON | N:1 | FK `difference_journal_entry` | C |

> R28 y R29 son **la misma relación persistida en ambos sentidos** sin restricción que garantice coherencia (I: puede divergir si un asiento se re-genera).

## 5. Otras

| # | Relación | Sem. | Persistencia | Evidencia |
|---|---|---|---|---|
| R33 | InventoryDocument → documento origen | DER | PGFK (`inventory/models.py:1452`); tipos usados: `sales.saleorder`, `sales.saledelivery`, `sales.salereturn`, `purchasing.purchasereceipt`, `purchasing.purchasereturn`, `billing.invoice`, `production.workorder` | C; D 21 sin origen |
| R34 | InventoryCount → InventoryDocument | DER | FK (`:1908`) | C |
| R35 | WorkOrder → Invoice nota | DER | FK `related_note` (`production/models.py:74`) | C |
| R36 | Partner*/ProfitDistribution → JournalEntry, TreasuryMovement, StockMove | CON/LIQ | FK (`contacts/partner_models.py:83-101,503`) | C |
| R37 | Cualquier doc → Attachment / Task / Comment / Notification | ASO | GFK | C |
| R38 | Cualquier doc → Transition (cancel/annul) | COR (auditoría) | PGFK string+id | C; solo 5 tipos escriben |
| R39 | SaleOrder → workflow.Task (aprobación crédito) | ASO | FK `credit_approval_task` | C |

## 6. Casos solicitados por el brief

| Caso | Estado |
|---|---|
| Pedido → varias entregas | Implementado (R1) a nivel doc+línea; **acumulado de cumplimiento roto** (R2) |
| Varias entregas → una factura | **No modelado**: la factura se vincula a la orden, no a entregas; no hay líneas de factura (R6) |
| Factura ← varios pagos | Sí vía FK (R21); importes por `amount` del movimiento |
| Un pago → varias facturas | Solo vía `PaymentAllocation` (R23), sin uso en datos; los flujos principales usan FK única |
| NC corrige factura | R13 (opcional en flujo legacy), con efectos logísticos R10/R11 y líneas en tabla de la OV (R12) |
| Doc → uno o varios asientos | 1:1 normal (R28); Payroll 2; StockMove N:1; reverso R30 |
