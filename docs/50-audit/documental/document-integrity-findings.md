# Hallazgos de integridad documental — Fase 2

> Entregable 2c · 2026-10-14 · Sin reparaciones ni modificaciones.
> Evidencia: **C** código · **E** ejecución (test efímero en scratchpad, reutilizando el fixture de `sales/tests/test_p24_confirm_delivery.py`) · **D** datos del dev server (demo, SELECT vía `manage.py shell`, 2026-10-14) · **I** inferido.
> Los datos demo no ejercitan notas de crédito/débito, devoluciones ni `PaymentAllocation` (0 filas): esas áreas quedan sin validación con datos.

## Severidad alta

### INT-01 · El despacho no registra cumplimiento por línea
- **Problema**: `SaleLine.quantity_delivered` solo se incrementa en `sales/services.py:710`, dentro del `else` que se ejecuta cuando el despacho **no** tiene detalles inventariables, y usa la variable `line` sobrante del bucle (solo la última línea).
- **Evidencia**: C (`sales/services.py:681-711`); E: tras `confirm_delivery` con 2 líneas inventariables → `quantity_delivered = 0`, `delivery_status = PENDING`; D: 107 de 132 líneas originales en OV `DELIVERED` tienen `quantity_delivered = 0`.
- **Impacto (I)**: `dispatch_order` fuerza `DELIVERED` (`:274`) y lo oculta en despachos completos, pero entregas parciales (`:477` → `_update_order_delivery_status`) recalculan desde un acumulado erróneo; las validaciones de NC (`sales/services.py:1087`, `billing/note_checkout_service.py:283,1109`) rechazarían devoluciones de productos inventariables por "excede cantidad entregada".
- **Contraste**: compras lo hace bien (`purchasing/services.py:499,624,711`).

### INT-02 · Línea de despacho → movimiento de stock nunca se enlaza
- **Problema**: emparejamiento por clave `(product_id, -qty)` contra moves creados con `abs(qty)` (`inventory/services.py:175`) → nunca coincide.
- **Evidencia**: C (`sales/services.py:686-703`); E; D: 83/83 líneas confirmadas inventariables con `stock_move NULL`; el test `test_p24_confirm_delivery.py:111-112` **afirma** el valor nulo (el bug quedó fijado como comportamiento esperado).
- **Impacto**: `StockMove.related_documents` (`inventory/selectors.py:832`), movimientos de stock de factura (`billing/selectors.py:99`), historial/estadísticas por cliente (`inventory/selectors.py:475-620`) quedan vacíos para ventas.
- **Relacionado**: recepciones 21/34 líneas sin `stock_move` (D) — causa no determinada (NV).

### INT-03 · Movimientos de stock sin vínculo tipado con su documento
- `InventoryDocumentDetail` no guarda el move generado y `StockMove` no tiene FK a documento; el único rastro es `description = "<tipo> Doc: <ref>"` (`inventory/services.py:179`).
- D: 126/140 StockMoves sin back-link tipado (de 5 posibles); 19 de ellos sin asiento.
- Imposible reconstruir de forma fiable StockMove → InventoryDocument → documento comercial.

### INT-04 · `InventoryDocument` de un despacho apunta a la OV, no al despacho
- `source_document_type="sales.saleorder"` (`sales/services.py:586`) mientras el `JournalEntry` del mismo despacho apunta al despacho (`:734`). D: 103 docs con origen OV.
- Con varias entregas por OV, los documentos de inventario no son distinguibles por origen.

### INT-05 · GFK `Invoice.source_order` muerto, pero con lógica que depende de él
- Ningún servicio lo escribe (solo la migración `billing/migrations/0011_t43_gfk_data_migration.py`). D: 168/168 facturas con NULL.
- Ramas afectadas (C): `post_invoice` omite validación de folio por proveedor (`billing/services.py:1451-1453`), no actualiza glosa del asiento (`:1477`) ni sincroniza tareas del Hub (`:1491`); `is_sale_document()` devuelve `True` para todas (incluidas facturas de compra) (`billing/models.py:196-199`), mitigado en `billing/selectors.py:182` por chequeo de `purchase_order_id`.

### INT-06 · Tres representaciones de pago → documento, cálculos de saldo divergentes
- FK legacy (`treasury/models.py:209-221`, única usada: D 248), GFK `allocated_to` (sin escritor, D 0), `PaymentAllocation` (D 0).
- Cálculos (C): `Invoice.total_paid` referencia `TreasuryMovement.Status` inexistente (`billing/models.py:181`) → `AttributeError` si se evalúa con pagos; `InvoiceSerializer.get_pending_amount` suma FK + allocations sin excluir anulados (`billing/serializers.py:82-85`, `:227-231`) → doble conteo si ambas vías apuntan a la misma factura (I; D 0 hoy); `SaleOrder.total_paid` no excluye anulados (`sales/models.py:249`, `sales/serializers.py:298`).
- D: 127/248 movimientos con `invoice` **y** `sale_order` (anticipos reasignados, `billing/services.py:539`): un mismo pago aparece en ambos documentos — correcto como jerarquía, pero sin semántica explícita.

### INT-15 · Anulación de pago con devolución afectaba la caja dos veces (corregido)
- E: test `treasury/tests/test_annul_with_refund.py`; C: `treasury/services.py` `annul_movement`. Detectado durante M0, corregido tras M1. Detalle en [registro de avance](./implementation-progress.md).

### INT-16 · Endpoint de traspasos internos roto (corregido)
- E: el frontend no enviaba `Idempotency-Key` y el servicio llamaba a `register_internal_transfer`, eliminado en `1b13c2f16`. Test `treasury/tests/test_register_transfer.py`. Detalle en [registro de avance](./implementation-progress.md).

## Severidad media

| ID | Hallazgo | Evidencia |
|---|---|---|
| INT-07 | Factura sin líneas propias: muestra todas las líneas de la OV/OC aunque la factura sea parcial; varias entregas → una factura no es representable | C `billing/selectors.py:75-82` |
| INT-08 | Líneas de NC/ND se guardan en `SaleLine`/`PurchaseLine` de la orden (`related_note`), mezclando pedido y corrección en una tabla; cada consumidor debe filtrar | C `sales/models.py:421`, `sales/serializers.py:286` |
| INT-09 | Devoluciones sin FK a la línea origen (venta/compra) → trazabilidad de devolución parcial solo por producto | C `SaleReturnLine`/`PurchaseReturnLine` |
| INT-10 | `corrected_invoice` opcional en flujo legacy de notas → NC sin documento corregido posible | C `sales/services.py:1105` |
| INT-11 | Doble sentido documento↔asiento (O2O + GFK) sin garantía de coherencia; 21 asientos automáticos sin origen | C; D |
| INT-12 | `PurchaseReceipt` / `SaleDelivery` en UI: `ENTITY_DRAWERS` los abre con `InventoryDocumentDrawer` → consulta `inventory/documents/{id}` con id de otra tabla | C `frontend/lib/entity-drawers.tsx:481,550` |
| INT-13 | `workflow.Transition` (cancel/annul) solo para 5 tipos; devoluciones, recepciones, asientos, cheques no lo registran | C |
| INT-14 | Emparejamiento por producto cuando falta id de línea en materiales tercerizados → ambigüedad con productos repetidos | C `purchasing/services.py:244,333` |

## Severidad baja / deuda

- `EntityPrefix.SALE_RETURN` y `PURCHASE_RETURN` comparten `DEV` → búsqueda por prefijo ambigua (`core/prefix_registry.py`).
- Numeración de asiento propia "último+1" sin bloqueo (`accounting/models.py:543-552`); `SequenceService` lee último por id sin `select_for_update` (`core/services/__init__.py:29`) — I: riesgo de duplicado concurrente (mitigado por `unique=True`).
- `JournalEntry.reference` deprecado pero aún escrito (`billing/services.py:1481`).
- Referencias a anulados: FKs `SET_NULL` hacia Invoice/OV desde pagos y OT; no se encontró política que impida vincular a documentos `CANCELLED` (NV en datos: 0 pagos anulados vinculados).
- Huérfanos de GFK: 0 asientos con origen colgante (D).
