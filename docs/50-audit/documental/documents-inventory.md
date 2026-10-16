# Inventario documental — Fase 1

> Auditoría documental · Entregable 1 · 2026-10-14 · Solo lectura (sin cambios de código).
> Ruta pedida en el brief: `docs/50-audit/documntal/` (errata) → se usa `docs/50-audit/documental/`.
>
> **Niveles de evidencia**: **[C]** confirmado en código · **[I]** inferido · **[NV]** no verificado (no se inspeccionaron datos reales).
> Método: extracción AST de todos los `models.py` (+ `contacts/partner_models.py`, `billing/note_workflow.py`), grep de registros, script de cruce de rutas contra `frontend/app/`.

---

## 1. Registros de identidad existentes (5 en paralelo)

| Registro | Archivo | Rol | Cobertura |
|---|---|---|---|
| `EntityPrefix` (enum) | `backend/core/prefix_registry.py:21` | Prefijos visibles | ~55 miembros; `SALE_RETURN` y `PURCHASE_RETURN` comparten `DEV` [C] |
| `UniversalRegistry` / `SearchableEntity` | `backend/core/registry.py:29`, registro en `*/apps.py` | Búsqueda global, plantillas, `detail_url_pattern` | ~40 entidades [C] |
| `DocumentRegistry` / `DocumentService` | `backend/core/services/document.py:16-58` | Ciclo de vida (confirm/cancel) polimórfico | **Solo 2**: `sales.saleorder` (`sales/services.py:1352`), `purchasing.purchaseorder` (`purchasing/services.py:1690`) [C] |
| `ENTITY_REGISTRY` | `frontend/lib/entity-registry.ts` | Título, icono, URLs en UI | ~70 labels; incluye labels sin modelo Django [C] |
| `ENTITY_DRAWERS` | `frontend/lib/entity-drawers.tsx:236` | Apertura global `openEntity(label,id)` | 37 labels [C] |

Además: `workflow.Transition` (`workflow/models.py:11`) — log append-only cancel/annul/purge con `entity_type` string + `entity_id`; escrito solo para SaleOrder, SaleDelivery, Invoice, TreasuryMovement, WorkOrder (`workflow/services.py:13` y llamadores) [C]. `GlobalSearchIndex` (GFK, `core/models/search.py:9`).

---

## 2. Inventario por categoría

### 2.1 Documentos transaccionales comerciales

| Técnico | Funcional | Base | Número visible | Estados | Anulación | Líneas | Historial |
|---|---|---|---|---|---|---|---|
| `sales.SaleOrder` (`sales/models.py:15`) | Orden de Venta `OV` | `TransactionalDocument` | `SequenceService` (`:267`) | DRAFT CONFIRMED PAYMENT_PENDING INVOICED PAID CANCELLED + `delivery_status` PENDING/PARTIAL/DELIVERED | `cancel_sale_order` + `DocumentService.cancel` | `SaleLine` (`:315`) **mezcla líneas de la OV y de NC/ND** vía `related_note` (`:421`) | simple_history + Transition |
| `sales.SaleDelivery` (`:528`) | Guía de Despacho `DES` | TransactionalDocument | Sequence (`:591`) | DRAFT CONFIRMED CANCELLED | `annul_delivery` | `SaleDeliveryLine` → `sale_line`, `stock_move` 1:1, `work_order` | sí + Transition |
| `sales.SaleReturn` (`:689`) | Devolución `DEV` | TransactionalDocument | Sequence (`:754`) | DRAFT CONFIRMED CANCELLED | `annul_return` | `SaleReturnLine` (**sin FK a línea origen**) | sí |
| `purchasing.PurchaseOrder` (`purchasing/models.py:16`) | Orden de Compra `OCS` | TransactionalDocument | Sequence (`:185`) | DRAFT CONFIRMED RECEIVED INVOICED PAID CANCELLED + `receiving_status` | `cancel_purchase_order` + DocumentService | `PurchaseLine` (+`related_note`) | sí |
| `purchasing.PurchaseReceipt` (`:343`) | Recepción `REC` | TransactionalDocument | Sequence (`:407`) | DRAFT CONFIRMED CANCELLED | `annul_receipt`/`cancel_receipt` | `PurchaseReceiptLine` → `purchase_line`, `stock_move` | sí |
| `purchasing.PurchaseReturn` (`:476`) | Devolución de Compra `DEV` | TransactionalDocument | Sequence (`:542`) | DRAFT CONFIRMED CANCELLED | `annul_return` | `PurchaseReturnLine` (sin FK a línea origen) | sí |
| `billing.Invoice` (`billing/models.py:15`) | Factura/Boleta/NC/ND/FACC (por `dte_type`) | TransactionalDocument | **folio manual**, no único (`:41`) | DRAFT POSTED PAID CANCELLED | `annul_invoice`/`cancel_invoice` | **No tiene modelo de líneas**: `get_lines` devuelve *todas* las líneas de la OV/OC (`billing/selectors.py:75-82`) [C] | sí + Transition |
| `billing.NoteWorkflow` (`billing/note_workflow.py:6`) | Checkout NC/ND por etapas | Model | — | Stage DRAFT…COMPLETED/CANCELLED | `cancel_workflow` | ítems en **JSON** (`selected_items`) | no |

### 2.2 Producción

| `production.WorkOrder` (`production/models.py:34`) | OT `OT` | Model | Sequence (`:294`) | status DRAFT IN_PROGRESS FINISHED CANCELLED + `Stage` (10 etapas, `:41`) | `annul_work_order` | `WorkOrderMaterial`, `ProductionConsumption`, `WorkOrderHistory` | sí + Transition |
|---|---|---|---|---|---|---|---|
| `production.BillOfMaterials` (`:472`) | BOM (maestro) | Model | `BOM-{id}` | — | — | `BillOfMaterialsLine` | no |

### 2.3 Inventario

| Técnico | Funcional | Identidad | Estados | Nota |
|---|---|---|---|---|
| `inventory.InventoryDocument` (`inventory/models.py:1425`) | Documento de Inventario `INV-{id}` | sin número; `display_id`/`__str__` = `INV-{id}` | DRAFT APPROVED CONFIRMED CANCELLED; tipos RECEIPT DELIVERY TRANSFER ADJUSTMENT PRODUCTION PARTNER_* | origen por **pseudo-GFK de texto** `source_document_type`/`source_document_id` (`:1452-1453`) |
| `inventory.InventoryDocumentDetail` (`:1562`) | Línea | — | — | **sin FK al StockMove generado** |
| `inventory.StockMove` (`:1276`) | Movimiento `MOV-{id}` | id | sin estado | **sin FK a documento**; vínculo a InventoryDocument solo en texto `description` (`inventory/services.py:179`) [C]; vínculo inverso 1:1 desde líneas de despacho/recepción/devolución/consumo |
| `inventory.InventoryCount` (`:1883`) | Toma de inventario | id | DRAFT IN_PROGRESS APPLIED CANCELLED | FK `document` → InventoryDocument |
| `inventory.Subscription` (`:1780`) | Suscripción `SUB` | id | ACTIVE PAUSED CANCELLED EXPIRED | — |

### 2.4 Tesorería, pagos y conciliación

| Técnico | Funcional | Identidad | Estados |
|---|---|---|---|
| `treasury.TreasuryMovement` (`treasury/models.py:86`) | Movimiento `TES-{id}` | id (sin número) | DRAFT POSTED CANCELLED (`MovementStatus`) |
| `treasury.PaymentAllocation` (`:2343`) | Distribución de pago | — | — (exactamente 1 destino, `clean()` `:2431`) |
| `treasury.ReconciliationMatch` (`:28`) | Grupo de conciliación | — | — |
| `treasury.BankStatement` / `BankStatementLine` (`:1253`/`:1355`) | Cartola `CAR` | id | DRAFT CONFIRMED CANCELLED / UNRECONCILED…EXCLUDED |
| `treasury.TerminalBatch` (`:1970`) | Lote terminal `LOT` | id | PENDING SETTLED RECONCILED INVOICED |
| `treasury.Check` (`:2460`) | Cheque `CHQ` | id (backend template usa `check_number`) | IN_PORTFOLIO … VOIDED ISSUED |
| `treasury.CreditCardStatement`, `CardPurchaseGroup/Installment`, `CardPendingCharge` | Tarjetas | id | varios |
| `treasury.BankLoan` / `LoanInstallment` / `CreditLine` | Créditos | id / code | varios |
| `treasury.POSSession` (+`POSSessionAudit`) | Sesión POS | id | OPEN CLOSED |

### 2.5 Contabilidad, impuestos, RRHH, socios

| `accounting.JournalEntry` (`accounting/models.py:381`) | Asiento `AS` | número por "último+1" propio (`:543-552`, no `SequenceService`) | DRAFT POSTED CLOSED CANCELLED REVERSAL | origen GFK `source_document` (`:435-439`), `reversal_of` (`:441`); `reference` DEPRECATED |
|---|---|---|---|---|
| `accounting.FiscalYear`, `Budget` | Ejercicio, presupuesto | — | OPEN CLOSING CLOSED | O2O closing/opening entry |
| `tax.F29Declaration`, `F29Payment`, `TaxPeriod`, `AccountingPeriod` | Tributario | folio / mes-año | — | O2O journal_entry |
| `hr.Payroll` (`hr/models.py:306`) | Liquidación `LIQ` | Sequence (`:414`) | DRAFT POSTED | 2 O2O asientos; `PayrollPayment`, `SalaryAdvance` |
| `contacts.PartnerTransaction`, `ProfitDistributionResolution` (+Line, Destination, Payment) | Socios | `PT-{id}`, `DIST-…` | DRAFT APPROVED EXECUTED CANCELLED | FK a JournalEntry, TreasuryMovement, StockMove |

### 2.6 Maestros, eventos, adjuntos
- Maestros: `Contact`, `Product` (+variantes), `Warehouse`/`Location`, `UoM`, `Account`, `TreasuryAccount`, `Bank`, `PaymentMethod`, `Employee`, `User`.
- Eventos/historial: `simple_history` (48 modelos), `workflow.Transition`, `WorkOrderHistory`, `ActionLog`, `workflow.Comment` (GFK), `workflow.Task` (GFK), `Notification` (GFK).
- Adjuntos: `core.Attachment` (GFK, `core/models/__init__.py:203`) + `Invoice.document_attachment` (FileField propio).

---

## 3. Mecanismos de relación encontrados

| # | Mecanismo | Ejemplos | Evidencia |
|---|---|---|---|
| M1 | FK/O2O tipados | `SaleDelivery.sale_order`, `*.journal_entry` (O2O), `SaleDeliveryLine.stock_move` | AST |
| M2 | GFK Django (ContentType) | `JournalEntry.source_document`, `Invoice.source_order`, `TreasuryMovement.allocated_to`, Attachment/Task/Comment | `accounting/models.py:435`, `billing/models.py:82`, `treasury/models.py:202` |
| M3 | Pseudo-GFK string+int (sin integridad referencial) | `InventoryDocument.source_document_type/id`, `Transition.entity_type/id` | `inventory/models.py:1452`, `workflow/models.py:23` |
| M4 | Texto libre | `StockMove.description` ("… Doc: ref"), `JournalEntry.reference` (deprecated), `TreasuryMovement.reference` | `inventory/services.py:179` |
| M5 | JSON | `NoteWorkflow.selected_items/logistics_data/...` | `billing/note_workflow.py` |
| M6 | Calculadas en selectores | `get_related_documents` de OV (dict por buckets), Factura y StockMove (listas con tipos ad-hoc `sale_order`, `credit_note`, `invoice`) | `sales/selectors.py:85`, `billing/selectors.py:85`, `inventory/selectors.py:826` |
| M7 | Heurística | StockMove ↔ línea de despacho emparejados por `(product_id, quantity)` | `sales/services.py:686-703` |

**Representaciones duplicadas de la misma relación [C]:**
- Factura → orden: GFK `source_order` **y** FKs legacy `sale_order`/`purchase_order` (`billing/models.py:82-94`); `display_id` usa `purchase_order_id`, `is_sale_document` usa `source_order`.
- Pago → documento: **tres** vías — GFK `allocated_to`, FKs legacy `invoice/sale_order/purchase_order` en `TreasuryMovement` (`:202-221`) y `PaymentAllocation` (`:2343`). Los cálculos de "pagado" divergen: `InvoiceSerializer.get_pending_amount` suma FK+allocations sin excluir anulados (`billing/serializers.py:82`); `Invoice.total_paid` referencia `TreasuryMovement.Status`, que **no existe** (la clase es `MovementStatus`) → AttributeError si se evalúa con pagos [C, `billing/models.py:181`]; `SaleOrder.total_paid` solo FK, sin excluir anulados (`sales/models.py:249`).

---

## 4. Patrones detectados (1.3)

| Aspecto | Situación | Reutilizable |
|---|---|---|
| Base común | `TransactionalDocument` solo en 7 modelos (OV, despacho, devolución, OC, recepción, dev. compra, factura). OT, asiento, movimiento tesorería, doc. inventario, nómina no lo usan | Sí, parcial |
| Número | `SequenceService` (7 modelos + OT + Payroll); asiento con lógica propia; factura folio manual; tesorería/stock/inventario usan `id` | Parcial |
| `display_id` | Propiedad en 26 modelos (lista arriba); InventoryDocument no la tiene | Sí |
| Estados | Vocabularios distintos: CONFIRMED vs POSTED vs APPROVED vs FINISHED; CANCELLED/CANCELED ortografía mixta (`CreditLine`, `LoanInstallment`) | No uniforme |
| Anulación | Funciones por módulo (`annul_*`, `cancel_*`, `void`, `reverse_*`); `DocumentService` solo 2 | Parcial |
| Relacionados | 3 formatos incompatibles (M6) | No |
| Historial | simple_history amplio; Transition solo 5 tipos | Sí |

---

## 5. UI: ficha y navegación (resumen para Fase 3)

- No hay páginas de detalle: `[id]/page.tsx` redirigen a `<lista>?selected={id}` (ADR-0020) o `openEntity` abre un drawer (ADR-0028). `SourceDocumentLink` (`frontend/components/shared/SourceDocumentLink.tsx`) resuelve drawer → url → texto.
- **29 `detailUrlPattern` sin ruta existente** (script de cruce; FE+BE). Ej.: `sales.saledelivery` (FE `/sales/deliveries/{id}`, BE `/sales/orders/deliveries/{id}` — ninguno existe), `treasury.treasurymovement` BE `/treasury/movements/{id}`, `production.bom`, `hr.absence`, `inventory.inventorydocument`, `purchasing.purchasereceipt/purchasereturn` (FE).
- Divergencias FE↔BE en el mismo label (budget `/finance` vs `/finances`, treasuryaccount, bankstatement, check, purchasereceipt…). BE `purchasing.purchasereturn` y varios de tesorería apuntan a listados sin id.
- Labels FE sin modelo Django: `finance.payment`, `finance.bankjournal`, `pos.session` (modelo real `treasury.possession`), `treasury.terminal(provider|device)`, `treasury.transfer`, `billing.purchaseinvoice`, `settings.*`, etc.
- **Bug probable [C en código, NV en ejecución]**: `ENTITY_DRAWERS['sales.saledelivery']` y `['purchasing.purchasereceipt']` montan `InventoryDocumentDrawer` con el id del despacho/recepción, que consulta `inventory/documents/{id}/` (`features/inventory/api/inventoryApi.ts:155`) — tabla distinta → muestra otro documento o 404. Además el InventoryDocument del despacho apunta a la **OV**, no al despacho (`sales/services.py:586`).
- Tipos ad-hoc en `related_documents` (`purchase_order`, `invoice`) no coinciden con labels `app.model` → `hasEntityDrawer` falla y se cae a URL (a veces lista sin id, `inventory/selectors.py:830`).

---

## 6. Pendiente de inspección (al cierre de la Fase 1)

> **Actualización (Fases 2-3)**: los puntos siguientes se inspeccionaron; resultados en [document-integrity-findings.md](./document-integrity-findings.md) (INT-01 confirma el bug de `quantity_delivered`) y [document-navigation-audit.md](./document-navigation-audit.md). La BD legacy `postgres-ordenes` no corresponde a este ERP; la verificación con datos se hizo contra el dev server.


- Servicios de creación: `sales/services.py`, `purchasing/services.py`, `billing/services.py` + `note_checkout_service.py`, `production/services.py` (OT desde OV/línea/nota), `treasury/services.py` (registro de pagos y allocations), `accounting/mapper` (qué setea `source_document`).
- Corroborar posible bug en `sales/services.py:706-711` (actualización de `quantity_delivered` en rama `else` usando variable de bucle).
- Frontend: `features/orders` (Order Hub, fases Production/Logistics/Billing), drawers `SaleOrderDrawer`, `InvoiceDrawer`, `JournalEntryDrawer`, `StockMoveDrawer`, `CashMovementDrawer`; `searchableEntityRoutes.ts`, `lib/utils.ts:477`, `features/_shared/transaction-drawer/types.ts`.
- Datos: BD legacy disponible vía MCP `postgres-ordenes` (solo lectura) para verificar huérfanos — todas las afirmaciones de integridad aquí son a nivel de esquema/código.
