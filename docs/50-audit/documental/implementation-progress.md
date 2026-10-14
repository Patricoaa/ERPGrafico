# Registro de avance de la implementación

> Rama: `feat/document-system` · Plan: [document-migration-roadmap.md](./document-migration-roadmap.md) · Decisiones: [document-decisions.md](./document-decisions.md).
> Cada entrada indica qué se cambió, cómo se verificó y qué quedó pendiente. Lo más reciente va arriba.

## Estado por fase

| Fase | Estado |
|---|---|
| M0 Hotfix | **Hecha** (GAP-07, GAP-04a, GAP-05; GAP-06 adelantado) |
| M1 Integridad | **Código hecho**; backfill de datos en dry-run, **pendiente de aprobación (D3)** |
| M2 Contratos | Pendiente |
| M3 UI piloto | Pendiente (GAP-06 ya hecho) |
| M4 Facturación y pagos | Pendiente |
| M5 Extensión | Pendiente |
| M6 Retiro | Pendiente |

---

## 2026-10-14 · M1 Integridad del piloto

### GAP-02 / GAP-03 · Vínculo tipado StockMove ↔ documento
- Migración `inventory/0033_inventorydocumentdetail_stock_move`: `InventoryDocumentDetail.stock_move` (O2O nullable, `SET_NULL`). Cada StockMove conoce su documento vía `move.inventory_document_detail.document`. Aplicada en el dev server (columna nullable, sin reescritura; SQL revisado con `sqlmigrate`).
- `InventoryService.confirmar_documento` enlaza cada detalle con el StockMove que genera.
- `SalesService.confirm_delivery` y `PurchasingService.confirm_receipt` / `confirm_return` enlazan cada línea con el StockMove **de su propio detalle** (`_link_lines_to_moves`), en lugar de la clave heurística `(product_id, -qty)` (ventas, nunca coincidía) o del `zip` por orden de inserción sin `ORDER BY` (compras).
- Consecuencia corregida: `annul_delivery` solo repone stock de líneas con `stock_move`; como nunca se enlazaba, **anular un despacho no devolvía el inventario**.

### INT-04 · Documento de inventario del despacho
- El `InventoryDocument` del despacho apunta a `sales.saledelivery` (antes a la OV). `confirm_return` de compras ahora también registra su documento origen.

### GAP-01 · Cumplimiento por línea
- `confirm_delivery` incrementa `quantity_delivered` en **todas** las líneas (antes solo, por error, en la última línea y solo si no había líneas inventariables), agregando por línea de OV.
- `dispatch_order` calcula `delivery_status` con `_update_order_delivery_status` en lugar de forzar `DELIVERED`.
- Test existente que fijaba el bug (`sales/tests/test_p24_confirm_delivery.py`, aserción `stock_move is None`) corregido; nuevo test de despacho parcial → PARTIAL → anulación → PENDING con reposición de stock.

### D5 · `audit_document_integrity` (solo lectura)
- `python manage.py audit_document_integrity [--strict]`. Umbrales del plan §5; `--strict` termina con error si alguno falla.
- Dev server (datos demo, antes del backfill): GAP-01 107 · despachos sin move 83 · recepciones sin move 21 · StockMove sin documento 90 %.

### D3 · `backfill_document_links` (dry-run por defecto)
- `python manage.py backfill_document_links [--apply]`. Sin `--apply` ejecuta todo en una transacción que se revierte; solo enlaza candidatos únicos.
- **Informe dry-run en el dev server** (verificado después con la auditoría que no se escribió nada):

| Paso | Corregibles | Sin candidato único |
|---|---|---|
| GAP-03 detalle → StockMove | 140 | 0 |
| GAP-02 línea de despacho → StockMove | 83 | 0 |
| GAP-02 línea de recepción → StockMove | 0 | 21 |
| INT-04 documento → despacho | 103 | 0 |
| GAP-01 líneas de OV con `quantity_delivered` | 107 | 0 OV omitidas |
| **OV que cambiarían de estado de entrega** | **0** | — |

- Las 21 recepciones no son reparables: sus productos **no tienen ningún StockMove** (recepciones demo confirmadas sin pasar por el servicio). Quedan como datos demo inconsistentes; no se tocan.
- **Pendiente:** aplicar con `--apply` en el dev server tras tu aprobación (D3).

### Verificación M1
- Tests nuevos: `core/tests/test_document_link_commands.py` (3), `sales/tests/test_p24_confirm_delivery.py` (actualizado + 1 nuevo). Fallan con el código anterior.
- Suites `billing sales purchasing treasury core workflow inventory production`: 560 passed; los 22 failed + 3 errors son exactamente la línea base preexistente (sin fallos nuevos). `billing/tests/test_note_manual.py::test_complete_workflow` falla de forma intermitente según el orden de ejecución (UNIQUE de `accounting_account.code`); se reprodujo igual sin los cambios.
- `makemigrations --check`: sin cambios pendientes. Ruff: sin errores nuevos.

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
