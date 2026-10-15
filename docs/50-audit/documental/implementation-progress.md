# Registro de avance de la implementación

> Rama: `feat/document-system` · Plan: [document-migration-roadmap.md](./document-migration-roadmap.md) · Decisiones: [document-decisions.md](./document-decisions.md).
> Cada entrada indica qué se cambió, cómo se verificó y qué quedó pendiente. Lo más reciente va arriba.

## Estado por fase

| Fase | Estado |
|---|---|
| M0 Hotfix | **Hecha** (GAP-07, GAP-04a, GAP-05; GAP-06 adelantado) |
| M1 Integridad | **Hecha** (código + backfill aplicado en dev) · INT-15 corregido |
| M2 Contratos | **Hecha** · ADR-0080 **Aceptado** (2026-10-14) |
| M3 UI piloto | **Hecha** (GAP-06, GAP-10, GAP-11, D4); verificación visual en navegador pendiente |
| M4 Facturación y pagos | **M4a, M4b y M4c hechas**; backfill de líneas en dry-run **pendiente de aprobación (D3)** · M4d (pagos) pendiente |
| M5 Extensión | Pendiente |
| M6 Retiro | Pendiente |

---

## 2026-10-15 · M4c · Notas sobre líneas de factura (GAP-14) e interfaz de facturación por entregas

**GAP-14 / D1.3 — notas con líneas propias:**
- `InvoicingService.build_note_lines(note, items)`: al confirmar una NC/ND por el checkout de notas (`/billing/note-workflows/checkout/`, único flujo expuesto) se crean sus `InvoiceLine`. En NC, cada línea apunta a la línea de la factura corregida (`corrected_line`, deducida del `line_id` de OV que ya envía el frontend: sin cambio de contrato) y **no se puede acreditar más de lo facturado** por línea. En ND, la línea factura la línea adicional de la nota.
- Lectura de líneas de una NC: lo "procesado" de cada línea es lo **devuelto para esa nota** (antes se usaba lo despachado de la OV, sin relación con la nota).
- **Corrección:** el checkout exigía que lo acreditado no superara lo *despachado* incluso para **servicios**, que nunca se despachan → no se podía emitir una NC por un servicio facturado. Ahora la validación de despachado aplica solo a productos entregables; para servicios rige lo facturado (D1.3).
- **Corrección:** `NoteCheckoutService.select_items` usaba `tax_rate` sin definir (NameError) cuando el IVA llegaba en 0. Flujo no expuesto por API, corregido igualmente.

**Interfaz — "Facturar por entregas" (Hub, OV y OC):**
- Acción `invoice-by-lines` en la categoría Documentos (`features/sales/actions.tsx`, `features/purchasing/actions.tsx`), visible si la orden no está completamente facturada; abre `InvoiceFromLinesModal` (`features/billing`).
- El modal muestra lo pendiente por orden: productos entregables por despacho/recepción confirmados (entregado / por facturar), servicios por cantidad; botón "Facturar todo lo pendiente"; tipo de documento, fecha, folio y "Publicar al crear"; interruptor **"Incluir otras órdenes del cliente/proveedor"** para la factura multi-orden.
- Datos con `useInvoiceableLines` / `useCreateInvoiceFromLines` (Zod; `Idempotency-Key` por intención); formulario con react-hook-form + `features/billing/schema.ts`. Invalida facturación, ventas, compras y documentos relacionados.

**PDF / DTE:** no hay generación en el backend; la impresión (`PrintableLayout` del `InvoiceDrawer`) usa `invoice.lines`, que ya sale de las líneas propias.

**Verificación:** `billing/tests/test_note_invoice_lines.py` (3: NC con `corrected_line` y procesado = devuelto, NC por sobre lo facturado rechazada, ND sobre su línea adicional); `features/billing/components/__tests__/InvoiceFromLinesModal.test.tsx` (2, dev server: carga, "facturar todo", envío con ítems e Idempotency-Key; estado vacío). Suites backend: 626 passed, sin fallos nuevos. Type-check y lint sin errores.

**No verificado en navegador** (requiere sesión). Recordatorio: aplicar `backfill_invoice_lines --apply` antes de usar la nueva acción con órdenes ya facturadas.

---

## 2026-10-14 · M4b · Facturación parcial y multi-orden por cantidad (backend)

**Servicio** `billing/invoice_from_lines.py` — `InvoiceFromLinesService.create(side, dte_type, items, status, number, date, payment_method)`; `items = [{order_line_id, quantity, fulfillment_line_id?}]` (`fulfillment_line_id` = línea de despacho en ventas / de recepción en compras). Reglas:
- **D1.1** por cantidad; nunca más de lo pendiente de facturar por línea.
- **D1.2** si la factura no completa todas las órdenes involucradas, cada línea de producto entregable (no servicio/suscripción) debe indicar su línea de despacho/recepción **confirmada**, y lo facturado contra ella no supera lo entregado.
- **D1** varias órdenes en una factura solo si son del mismo cliente/proveedor; órdenes en borrador o anuladas no se facturan; líneas de notas no se facturan por esta vía.
- Totales con las mismas estrategias de la orden (`GrossFirstTotals` venta / `NetFirstTotals` compra) sobre las líneas de la factura; el descuento global de la orden se prorratea por bruto facturado y la factura que completa la orden toma el resto (sin descuadre acumulado).
- **Asiento desde las líneas propias**: `AccountingMapper.get_entries_for_sale_invoice`, `get_entries_for_purchase_bill` (IVA capitalizado de boletas) y `_build_revenue_grouping` (estrategias DTE) leen `invoice.lines` (legacy: líneas de la orden).
- **D2 anticipos**: los pagos de las órdenes sin factura se imputan **por importe** con `PaymentAllocation` hasta el total de la factura (asiento de conciliación RECO por lo imputado); el saldo queda para la siguiente factura. Cancelar/anular libera las imputaciones (al anular, revierte el RECO). La orden cuenta el anticipo una sola vez (`PaymentSelector`).
- Estado: la orden pasa a `INVOICED` (estado principal) y `invoicing_status` se recalcula; al anular, **cada** orden de la factura sin otra factura activa vuelve a su estado previo.

**Endpoints:**
- `POST /api/billing/invoices/from-lines/` (requiere `Idempotency-Key`, scope `billing.invoice.from_lines`) → 201 con la factura; 400 con el motivo de la regla incumplida.
- `GET /api/billing/invoices/invoiceable-lines/?side=sale|purchase&partner=<id>|orders=<ids>` → órdenes con líneas pendientes, cada una con sus entregas confirmadas (entregado / facturado / pendiente).

**Verificación:** `billing/tests/test_invoice_from_lines.py` — 8 escenarios D6: parciales atadas a despachos PENDING→PARTIAL→INVOICED con asiento cuadrado; más de lo entregado (rechazo); parcial sin despacho de entregable (rechazo) y de servicio (válida); multi-orden mismo cliente; clientes distintos (rechazo); más de lo pendiente (rechazo); anticipo de 2.000 repartido 1.190 + 810 y liberado al cancelar; endpoints con Idempotency-Key. Suites backend: 623 passed, sin fallos nuevos. Selector probado sobre datos del dev server (solo lectura).

**Importante para el dev server:** hasta aplicar `backfill_invoice_lines --apply`, las órdenes ya facturadas aparecen con 0 facturado (p. ej. OV-000001 muestra 10 pendientes) y **podrían volver a facturarse** por la nueva vía. Aplicar el backfill antes de usarla.

**Pendiente:** M4c — notas sobre líneas de factura (GAP-14) e interfaz de facturación parcial/multi-orden (Hub/facturación); DTE/PDF leyendo `invoice.lines`. M4d — pagos.

---

## 2026-10-14 · M4a · Facturas con líneas propias (base)

**ADR-0081** (`docs/10-architecture/adr/0081-invoice-lines-partial-and-multi-order-invoicing.md`, Accepted — formaliza D1.1–D1.4 y D2). Entrega por etapas: M4a base · M4b facturación parcial y multi-orden · M4c notas sobre líneas de factura + UI · M4d pagos.

**Modelo** (migraciones `billing/0019_invoiceline`, `sales/0018_…`, `purchasing/0013_…`, aplicadas en el dev server; solo agregan tabla y columnas):
- `billing.InvoiceLine` (`invoice.lines`): `sale_line`/`purchase_line`, `delivery_line`/`receipt_line`, `corrected_line` (para M4c), producto, cantidad, precios, impuesto, descuento, subtotal.
- `SaleLine.quantity_invoiced`, `PurchaseLine.quantity_invoiced`; `SaleOrder.invoicing_status` y `PurchaseOrder.invoicing_status` (PENDING/PARTIAL/INVOICED, D1.4), expuestos de solo lectura en los serializers.

**Servicio** `billing/invoicing.py` — `InvoicingService`: `mirror_order_lines` (factura = orden completa, como hasta ahora), `recompute_order` (contadores y estado, solo facturas principales no anuladas: FACTURA, exentas, BOLETA, COMPROBANTE_PAGO, PURCHASE_INV), `orders_of` / `invoices_of` (N:M desde las líneas + FK principal).
- Enganchado en `create_sale_invoice`, `create_purchase_bill`, `cancel_invoice`, `annul_invoice`.

**Lectura** (`InvoiceSelectorExt.get_lines`): desde `InvoiceLine`, con la **misma forma** que antes (cada ítem es la línea de OV/OC con `quantity`/`subtotal` de la factura e `invoice_line_id`), porque el flujo de notas usa ese `id` como línea de OV hasta GAP-14. Legacy (sin backfill): las **notas** devuelven sus propias líneas (antes, todas las de la orden: el modal logístico de la nota y su estado logístico mostraban líneas ajenas); las facturas, solo las líneas originales de la orden.

**Relaciones:** factura ↔ orden en los proveedores de ventas, compras y facturación se deriva de las líneas (N:M).

**Correcciones encontradas:**
- `BillingService.cancel_invoice` borraba el asiento borrador mientras la factura lo referenciaba (FK PROTECT) → **cancelar una factura en borrador fallaba siempre**. Ahora desvincula y luego borra.
- Fallos intermitentes "UNIQUE accounting_account.code" en la suite: la caché locmem (singleton `AccountingSettings`) sobrevivía entre tests mientras la BD se revertía; al guardarse, regeneraba códigos de cuentas raíz. Nuevo fixture autouse en `backend/conftest.py` que limpia la caché después de configurar el backend de test. Resultado: 4 tests de `accounting` de la línea base pasan.

**Backfill** `python manage.py backfill_invoice_lines [--apply]` (dry-run por defecto, D3). **Dry-run en el dev server:** 168 facturas → 173 líneas espejo; OV: 128 `INVOICED`; OC: 40 `INVOICED`, 3 `PENDING`; ninguna orden facturada por sobre lo pedido. **Pendiente de aprobación.** Mientras no se aplique, las facturas antiguas se leen por el camino legacy.

**Verificación:** `billing/tests/test_invoice_lines.py` (7: líneas propias y contadores, cancelación, PARCIAL, factura de compra, líneas de nota legacy, relaciones multi-orden, backfill dry-run/apply). Suites `billing sales purchasing treasury core workflow inventory production accounting`: 615 passed, sin fallos nuevos; 4 fallos de la línea base resueltos.

---

## 2026-10-14 · M3 UI del piloto

ADR-0080 pasa a **Accepted** por decisión del responsable del proyecto.

**Navegación con pila y "volver" (GAP-11)** — `components/providers/GlobalModalProvider.tsx`:
- `openEntity` apila (máx. 5) cuando ya hay un documento abierto; reabrir el superior es no-op; `closeEntity` vacía la pila; nuevo `goBackEntity`; `openEntity(..., { display })` para el texto del "volver".
- El drawer superior se envuelve en `EntityNavigationContext` (nuevo, `components/shared`); el `Drawer` compartido muestra "← Volver a …" sin tocar cada drawer, y resetea el contexto para drawers anidados.

**OV/OC → Order Hub (D4):** `openEntity('sales.saleorder' | 'purchasing.purchaseorder')` abre el Hub (`openHub`) en lugar de los drawers delgados (nuevo `useOptionalHubPanel`).

**Ficha común y relacionados (GAP-10):**
- `RelatedDocumentsTable` y `DocumentDrawerShell` en `components/shared` (solo presentación; loading/empty/error).
- `DocumentRelationsSection` en `features/documents` (datos con `useDocumentRelations`, apertura con `openEntity`).
- `SaleDeliveryDrawer` y `PurchaseReceiptDrawer` migrados a `DocumentDrawerShell`.
- Sección de relacionados añadida a `InvoiceDrawer`, `CashMovementDrawer` (movimiento de tesorería), `JournalEntryDrawer` (vista), `StockMoveDrawer` (reemplaza la lista en texto plano no navegable) e `InventoryDocumentDrawer`.
- Order Hub: sección "Documentos relacionados" de la OV/OC (o de la factura en modo nota). Sus documentos se abren con `openEntity` (pila y fichas nuevas); los pagos se abren como `treasury.treasurymovement` por id. La OV/OC propia sigue en su drawer local.

**Corrección encontrada:** `openEntity('accounting.journalentry', id)` sin datos abría el formulario de **creación**; ahora abre el asiento en modo vista cargado por id (`lib/entity-drawers.tsx`).

**Adelantado de M5:** proveedores de relaciones de compras (`purchasing.purchaseorder`, `purchasing.purchasereceipt`) para que la ficha de recepción y el Hub de compras no queden sin relacionados; la recepción usa el resolvedor `/d/`.

**Contratos actualizados:** `component-entity-drawers.md` (pila, `goBackEntity`, D4, asiento por id) y `document-relations.md` (§5 componentes de UI).

**Verificación:**
- Frontend (dev server): `GlobalModalProvider.test.tsx` (pila, volver, cierre, D4 → Hub), `RelatedDocumentsTable.test.tsx` (agrupación, sin acceso, estados, "volver" del Drawer), tests de despacho/recepción y resolvedor → 15 en verde. Suite completa de vitest: solo falla `semantic-ink.test.ts` (preexistente, ambiental).
- Backend: `core/tests/test_document_relations.py` 7/7 (incluye recepción de compra con `confirm_receipt` real) y sincronía de rutas.
- `npm run type-check` y `eslint` sin errores.
- **No verificado en navegador** (la app requiere sesión): recorrido OV → Hub → despacho → movimiento de stock → "volver".

**Pendiente (M4–M6):** facturación con líneas propias y pagos (M4); extensión a producción/tesorería restante y retiro de `DRAWER_MAP`/`LazyDrawer` (GAP-12, M5); retiro de formatos legacy y drawers delgados de OV/OC (M6).

---

## 2026-10-14 · M2 Contratos (aditivo)

**ADR-0080** (`docs/10-architecture/adr/0080-document-model-relations-and-navigation.md`, estado **Proposed**): modelo documental común sin tabla `Document` ni tabla genérica de relaciones; `DocumentTypeRegistry` como extensión de `UniversalRegistry`; `DocumentRef`; servicio de relaciones con proveedores por app; URL canónica generada por el registro y resolvedor `/d/{label}/{id}`. La parte implementada en M2 es **aditiva** (no modifica contratos vigentes). M3 sí los modifica (drawers, `openEntity` con pila, Hub) y **requiere aceptar el ADR**.

**Contrato nuevo:** `docs/20-contracts/document-relations.md` (enlazado desde `docs/README.md` y `CLAUDE.md`).

**Backend (`core/documents/`):**
- `types.py` — `DocumentType` / `DocumentTypeRegistry` (URL canónica, campos de estado/fecha/contraparte, permiso de lectura). `UniversalRegistry.get(label)` añadido.
- `refs.py` — `build_ref` / `ref_for` / `missing_ref`: `exists=false` para referencias colgantes; sin permiso → `accessible=false` y sin contenido.
- `relations.py` — `Link`, `DocumentRelationService`, `@relation_provider`; deduplica y separa `unresolved`.
- Proveedores en `<app>/relations.py` (autodescubiertos en `CoreConfig.ready`): `sales` (OV, despacho), `billing` (factura; factura ↔ orden como lista, D1), `treasury` (movimiento + `PaymentAllocation`), `accounting` (asiento: origen GFK, reversiones, movimientos de stock), `inventory` (StockMove vía los vínculos tipados de M1, documento de inventario). `purchasing` solo declara la URL canónica de la OC (proveedores en M5).
- Endpoints `GET /api/core/documents/{label}/{id}/` y `/relations/?semantic=&direction=` (404 tipo/documento desconocido, 403 sin permiso sobre el documento pedido).

**URL canónica:** `?selected` solo donde la lista abre ese documento (OV/OC/factura de venta → Order Hub por D4; asiento; movimiento de tesorería; StockMove). Hallazgo: en `/sales/orders/deliveries`, `?selected` es id de **OV** (abre el formulario de despacho), así que el despacho y los demás tipos usan el resolvedor `/d/{label}/{id}`.

**Frontend (`features/documents`, aditivo):** tipos Zod (`DocumentRef`, `DocumentLink`, `DocumentRelations`), `useDocumentRef`, `useDocumentRelations` (lo consumirá M3), `DocumentResolverView` y la página `app/(dashboard)/d/[label]/[id]`: redirige a la URL canónica o abre el drawer registrado con `openEntity`.

**Verificación:**
- `core/tests/test_document_relations.py` (6): flujo piloto OV → despacho → stock → documento de inventario → factura → pago → asiento, filtros, `unresolved` con origen borrado, permisos (403/404, `accessible=false`).
- `core/tests/test_document_routes_sync.py`: toda URL canónica declarada y el resolvedor tienen ruta en `frontend/app` (falló antes de crear `/d/[label]/[id]`, pasa después).
- `features/documents/components/__tests__/DocumentResolverView.test.tsx` (3, en el dev server).
- **Datos demo del dev server** (servicio, solo lectura): 128 OV recorridas con sus 128 despachos, 128 facturas, 127 pagos, 83 StockMove y 338 asientos → **`unresolved` vacío en todo el piloto** (criterio de aceptación del plan). `GET /api/core/documents/sales.saledelivery/1/` → 200, `url=/d/sales.saledelivery/1`. La ruta `/d/...` responde 200 en el Next.js del dev server (no probada visualmente: requiere sesión).
- Suites `billing sales purchasing treasury core workflow inventory production accounting`: sin fallos nuevos frente a la línea base (los de `accounting` se reprodujeron igual en un worktree del commit anterior). Type-check y lint del frontend sin errores.

**Pendiente para M3 (requiere ADR-0080 aceptado):** `DocumentDrawerShell` + `RelatedDocumentsTable`, `openEntity` con pila y "volver", `openEntity` de OV/OC → Hub (D4), Hub consumiendo `relations`, retiro de `DRAWER_MAP`.

---

## 2026-10-14 · INT-16 · Traspasos internos (corregido)

**Diagnóstico (E):** el endpoint `POST /api/treasury/dashboard/register_transfer/` fallaba por dos causas encadenadas:
1. El frontend (`TransferDrawer` → `useTransfer` → `treasuryApi.registerTransfer`) no enviaba `Idempotency-Key`, que el endpoint exige (`@idempotent_endpoint`) → 400 antes de llegar al servicio.
2. `register_internal_transfer_from_request` llamaba a `TreasuryService.register_internal_transfer`, eliminado en el refactor `1b13c2f16` → `AttributeError`. La llamada además pasaba `notes`/`date` en el orden contrario a la firma antigua.

**Corrección:**
- `TreasuryService.register_internal_transfer(from, to, amount, created_by, notes, date)` reimplementado sobre `create_movement(TRANSFER)`, que genera el asiento (Cr origen / Dr destino). Rechaza origen = destino. La fecha ISO se convierte a `date`.
- Frontend: `Idempotency-Key` generado una vez por intención en `TransferDrawer` (estado con inicialización perezosa; se renueva tras completar), pasado en las variables de la mutación según [idempotency.md](../../20-contracts/idempotency.md).

**Tests:** `treasury/tests/test_register_transfer.py` (2, por el endpoint real con cabecera): saldos de ambas cuentas, tipo, fecha y notas; rechazo de misma cuenta. Fallan con el código anterior. Suite `treasury`: 274 passed; los 11 fallos son de la línea base preexistente. Frontend: type-check y lint sin errores nuevos.

---

## 2026-10-14 · INT-15 · Anulación de pago con devolución (corregido)

**Diagnóstico (E, test ejecutado):** `TreasuryService.annul_movement` con `treasury_account_id` revertía el asiento del pago **y** registraba un movimiento de devolución con su propio asiento contra CxC/CxP. Resultado medido sobre los saldos contables:
- Cobro de OV de 100, anulado con devolución a la misma caja → Caja −100 y CxC +100 respecto de antes del cobro (esperado 0 y 0).
- Pago de OC de 100, anulado con reembolso a la misma caja → Caja +100 (esperado 0).
- Devoluciones parciales aceptadas: se anulaba el pago completo pero solo se devolvía una parte; el resto desaparecía de la contabilidad.

**Alcance:** no es solo la acción manual "Anular con devolución" del Hub. `cancel_sale_order`, `annul_invoice(force=True)` y la cancelación de OC anulan sus pagos contabilizados **con devolución a la misma cuenta**, así que toda cancelación de una orden con pagos descontaba la caja dos veces. En el dev server había 0 casos históricos (verificado con SELECT), por lo que no hubo datos que reparar.

**Regla implementada** (`treasury/services.py` `annul_movement`):
- La reversión del asiento del pago ya deshace el pago completo (restituye CxC/CxP y saca el dinero de la cuenta original). La devolución no genera otro asiento contra CxC/CxP.
- Devolución desde la **misma cuenta** del pago: nada más que registrar.
- Devolución desde **otra cuenta**: traspaso interno (`TRANSFER`) entre la cuenta elegida y la original, sin vínculo con la orden/factura (no altera el pagado).
- Devolución **parcial** dentro de una anulación: se rechaza; para eso están "Registrar devolución" (`register_payment_return`, que mantiene el pago vigente) o una Nota de Crédito.
- Cheques: se anula el cheque; su movimiento queda como registro sin asiento y sin vínculo documental.

**Frontend:** el modal "Anular Pago" del Hub (`TreasuryPhase.tsx`) bloquea montos parciales y muestra el motivo.

**Control permanente:** `audit_document_integrity` incluye el umbral "INT-15 devoluciones por anulación con asiento propio = 0" para detectar datos generados antes del arreglo (gate D5).

**Tests:** `treasury/tests/test_annul_with_refund.py` (5): misma cuenta, otra cuenta, sin devolución, parcial rechazada, pago de OC. 4 fallaban con el código anterior. Suites `billing sales purchasing treasury core workflow inventory production`: 565 passed; los 25 fallos/errores son la línea base preexistente.

**Hallazgo lateral (corregido después, ver INT-16):**
- **INT-16 · Traspasos internos rotos.** `TreasuryService.register_internal_transfer_from_request` (usado por `treasury/views.py:1054`) llama a `register_internal_transfer`, que no existe → `AttributeError` en cada traspaso desde ese endpoint. Evidencia C (grep: sin definición).

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
- **Aplicado el 2026-10-14** con `--apply` tras aprobación (D3). Resultado idéntico al dry-run; una segunda ejecución no encuentra nada más (idempotente). Auditoría posterior: GAP-01 0 · despachos sin move 0 · StockMove sin documento 0 % · recepciones sin move 21 (demo sin movimientos, no reparables).

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

### INT-15 · ver entrada "INT-15" más arriba (corregido después de M1)

### Verificación M0
- Backend: suites `billing sales purchasing treasury core workflow` → 430 passed, 22 failed, 3 errors. Los 25 fallos/errores se reprodujeron **idénticos sin los cambios de M0** (preexistentes: baseline financiero, dedup de cartolas, tests que leen archivos de docs, rendimiento de búsqueda, invariantes de modelos). Los 9 tests nuevos pasan y fallan con el código anterior (salvo 1 de control).
- Frontend: `npm run type-check` y `eslint` sin errores en los archivos tocados; tests de drawers en verde en el dev server. `features/orders`, `features/_shared` y `lib`: 35/36 en verde; el fallo (`semantic-ink.test.ts`) es preexistente y ambiental (busca `/docs/20-contracts/color-system.md`, no montado en el contenedor).
- Ruff: sin errores nuevos en los archivos tocados (39 preexistentes).
