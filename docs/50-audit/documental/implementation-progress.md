# Registro de avance de la implementación

> Rama: `feat/document-system` · Plan: [document-migration-roadmap.md](./document-migration-roadmap.md) · Decisiones: [document-decisions.md](./document-decisions.md).
> Cada entrada indica qué se cambió, cómo se verificó y qué quedó pendiente. Lo más reciente va arriba.

## Estado por fase

| Fase | Estado |
|---|---|
| M0 Hotfix | **Hecha** (GAP-07, GAP-04a, GAP-05; GAP-06 adelantado) |
| M1 Integridad | Pendiente |
| M2 Contratos | Pendiente |
| M3 UI piloto | Pendiente (GAP-06 ya hecho) |
| M4 Facturación y pagos | Pendiente |
| M5 Extensión | Pendiente |
| M6 Retiro | Pendiente |

---

## 2026-10-14 · M0 Hotfix

### GAP-07 · Hub de compras: recepciones en vez de StockMoves
- `purchasing/selectors.py` `get_related_documents`: una entrada por `PurchaseReceipt` (`id` de la recepción, `docType: "purchase_receipt"`, `status`, `stock_moves` anidados), igual que los despachos de ventas. Se incluyen recepciones sin `stock_move` (antes se omitían).
- Efecto: "Anular Recepción" del Hub envía el id correcto a `annulPurchaseReceipt`; el badge "Ver Recepciones" cuenta recepciones, no movimientos.
- Test: `purchasing/tests/test_related_documents_receipts.py` (falla con el código anterior, pasa con el nuevo).

### GAP-06 · Drawers de despacho y recepción (adelantado desde M3)
- Motivo: tras GAP-07 las recepciones son clicables y abrían `InventoryDocumentDrawer` con un id de otra tabla, que además ofrece **confirmar/anular** ese documento ajeno.
- Nuevos `features/sales/components/SaleDeliveryDrawer.tsx` y `features/purchasing/components/PurchaseReceiptDrawer.tsx` (solo lectura, sobre los hooks existentes `useSaleDelivery` / `usePurchaseReceipt`). Enlazan a la orden y a cada movimiento de stock con `SourceDocumentLink`.
- Registrados en `ENTITY_DRAWERS` (`sales.saledelivery`, `purchasing.purchasereceipt`) y en `DRAWER_MAP` (`sale_delivery`, `purchase_receipt`).
- Test: `features/purchasing/components/__tests__/PurchaseReceiptDrawer.test.tsx` (verifica que cada drawer pide su endpoint y no `/inventory/`). Ejecutado en el dev server (Node local v18 no soporta la versión de vitest).
- Pendiente para M3: migrarlos a `DocumentDrawerShell` + `RelatedDocumentsTable`.

### GAP-04(a) · Cálculo único de "pagado"
- Nuevo `treasury/selectors.py` `PaymentSelector.paid_amount(...)`: ignora movimientos `CANCELLED`, aplica **signo** según dirección (venta: INBOUND suma, OUTBOUND resta; compra: al revés), suma `PaymentAllocation` y opcionalmente excluye pagos de NC/ND.
- Lo usan: `Invoice.total_paid`, `SaleOrder.total_paid`, `PurchaseOrder.total_paid`, y los serializers de factura (2), OV y OC (que ahora delegan en el modelo).
- Corrige: `Invoice.total_paid` usaba `TreasuryMovement.Status` (inexistente) y fallaba con cualquier pago; OV/OC sumaban pagos anulados y sumaban las devoluciones como pagos.
- **Hallazgo nuevo (corregido):** `TreasuryReturnService.register_payment_return` y `TreasuryService.annul_movement` (con devolución) asignaban `order.pending_amount`, que es una propiedad sin setter → `AttributeError` y rollback: **ambas operaciones fallaban siempre sobre pagos de OV/OC**. Se eliminaron esas asignaciones; el saldo se deriva del movimiento de devolución ya enlazado.
- Tests: `treasury/tests/test_payment_selector.py` (3 tests; fallan con el código anterior).

### GAP-05 · `Invoice.source_order` (GFK vacío) reemplazado por FK tipadas
- Nueva propiedad `Invoice.order` (`sale_order or purchase_order`). `is_sale_document()` y `get_customer_for_payment()` ya no dependen del GFK.
- `BillingService.confirm_invoice`: la unicidad de folio de compra **por proveedor** vuelve a validarse; la glosa del asiento y `sync_hub_tasks` vuelven a ejecutarse.
- `BillingService.annul_invoice`: vuelve a revertir el estado de la orden, **solo si no le queda otra factura principal activa** (preparación para D1: varias facturas por orden).
- El GFK sigue en el modelo; su retiro (migración) queda para M6.
- Tests: `billing/tests/test_invoice_order_link.py` (4 tests; 3 fallan con el código anterior).

### Hallazgo pendiente de decisión (no corregido)
- **INT-15 · Anulación de pago con devolución invierte la caja dos veces.** `annul_movement` con `treasury_account_id`: revierte el asiento del pago (Dr CxC / Cr Caja) **y** crea un movimiento de devolución con su propio asiento (Dr CxC / Cr Caja). Un pago de 100 anulado con devolución total deja Caja en −100 y CxC en +100 respecto del estado previo al pago (debería quedar en 0 y 0). Evidencia: lectura de código (C), no ejecutado. El nuevo `PaymentSelector` es coherente con ese libro (la devolución resta), por lo que el saldo pendiente mostrado también refleja el doble efecto. Requiere decidir la semántica correcta (¿la anulación con devolución debe solo revertir, o solo registrar la devolución?) antes de corregir. Evidencia: `treasury/services.py` `annul_movement` (reverse_entry + asiento de devolución).

### Verificación M0
- Backend: suites `billing sales purchasing treasury core workflow` → 430 passed, 22 failed, 3 errors. Los 25 fallos/errores se reprodujeron **idénticos sin los cambios de M0** (preexistentes: baseline financiero, dedup de cartolas, tests que leen archivos de docs, rendimiento de búsqueda, invariantes de modelos). Los 9 tests nuevos pasan y fallan con el código anterior (salvo 1 de control).
- Frontend: `npm run type-check` y `eslint` sin errores en los archivos tocados; tests de drawers en verde en el dev server. `features/orders`, `features/_shared` y `lib`: 35/36 en verde; el fallo (`semantic-ink.test.ts`) es preexistente y ambiental (busca `/docs/20-contracts/color-system.md`, no montado en el contenedor).
- Ruff: sin errores nuevos en los archivos tocados (39 preexistentes).
