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
| M4 Facturación y pagos | **Hecha** (M4a–M4d); backfill de líneas **aplicado** en dev (2026-10-15); pagos: se mantiene FK + imputaciones (decidido) |
| M5 Extensión | **Hecha** (relaciones en todos los módulos, GAP-08, GAP-12, escenarios D6 de devoluciones) |
| M6 Retiro | **Hecha en lo retirable**; formatos legacy con consumidores en fase de deprecación (bloqueados por la migración del Order Hub) |
| U0 Contratos (etapa UI) | **Hecha** — ADR-0083 (Accepted), `component-document-sheet.md`, D7–D11 |
| U1 Primitivas | **Hecha** — `domain` en `DocumentRef`, shell con tabs/ciclo/acciones/embedded, `DocumentRelationsTab`, motor de acciones extraído |
| U2 Piloto OV | **Hecha** + refinamiento del responsable (2026-10-15): referencia para U3–U5; verificación en navegador pendiente |
| ADR-0084 Estados desacoplados del pago | **Hecha** (2026-10-15) — migración aplicada en dev |
| U3 OC + facturas/notas | **Hecha** (2026-10-15) — ver entrada |
| U4 Puntos de entrada | **Hecha** (2026-10-15) — ningún flujo abre el Hub |
| U5 Resto de fichas | **Hecha** (2026-10-15) |
| U6 Retiro | **Hecha** (2026-10-15) — Order Hub y formatos legacy de relaciones eliminados |

---

## 2026-10-15 · U6 — retiro del Order Hub y de los formatos legacy de relaciones

**Frontend (Hub):** eliminados `ActionButton`, `ActionCategory`, `DocumentListModal`, `GlobalHubPanel`, `OrderActionPanel`, `OrderHeaderDashboard`, `OrderHubView`, `OrderHubPanel`, las 5 fases + `PhaseCard`, `useOrderDetail`, `hooks/useOrderHubData` y `HubPanelProvider` (~3.000 líneas). `app/layout` ya no monta Hub; `DashboardShell`, `ActionDock` y `globals.css` sin `data-hub-open`/`--hub-width`. Las fichas cargan con `useOrderDocument`/`useInvoiceDocument` (claves bajo ventas/compras/facturas → se refrescan con las invalidaciones existentes; permisos desde `AuthContext`). Se conservan `NoteLogisticsModal`, `PaymentHistoryModal` y `AnnulPaymentModal` (los usa el motor de acciones).

**Formatos legacy (backend + frontend):**
- OV/OC: `related_documents` → campos tipados `invoices`, `notes`, `deliveries`/`receipts` (`get_document_summary`) y `serialized_payments` con `status`. Los registros de acciones, el ciclo, las acciones por fila, el checkout de notas y las vistas de compras/ventas leen los campos nuevos.
- Factura: retirados `related_documents`, `related_stock_moves`, `related_returns` (ningún consumidor leía datos reales: la lista no tenía pagos y los movimientos no tenían estado).
- Asiento: `source_documents` → `source_document` (`DocumentRef`); el visor lo enlaza con `DocumentRefLink` y la edición usa `source_content_type_id`/`source_object_id`.
- **Bug corregido de paso:** "pago contabilizado" se buscaba en `journal_entry.state`, que el bucket nunca traía → la devolución de pago sobre factura en borrador no podía funcionar; ahora es `status === 'POSTED'`.

**Docs:** `document-relations.md` §6 (formatos retirados y su reemplazo), `api-contracts.md`, `frontend-fsd.md`, `hook-contracts.md`, `component-row-actions.md`, `component-document-sheet.md`, ADR-0080 (decisión 7 completa) y ADR-0083 (U0–U6 implementado).

## 2026-10-15 · U5 — resto de fichas documentales

- Nuevo **`DocumentSheet`** (`@/features/documents`): ficha estándar = cabecera (estado + menú de acciones con imprimir) · ciclo opcional · tabs Resumen (contexto en una fila + secciones del tipo) · [propios] · Relaciones · sidebar de actividad; fija el número en la pila ("Volver a …"). Componentes de apoyo: `DocumentRefLink` (enlace apilado, reemplaza el local de la ficha de factura) y `DocumentRelationsButton`.
- Migradas a `DocumentSheet` (contexto + secciones con `*Fields.toColumns()`, invariante 13): despacho (`saleDeliveryLineFields`), recepción (`purchaseReceiptLineFields`), devolución de compra (`purchaseReturnLineFields`), documento de inventario (`inventoryDocumentDetailFields`; confirmar/anular en el menú), movimiento de stock, movimiento de tesorería, cheque, lote de terminal, distribución de resultados (`profitDistributionLineFields`). Productos, OV/OC y socios enlazados con "volver".
- Flujos propios que conservan su UI y ganan acceso a Relaciones: **OT** (`WorkOrderWizard`, aplicación de producción a pantalla completa) y **liquidación de sueldo** (`PayrollDetailView`) → botón "Relaciones (n)" en la cabecera con el tab reutilizable en panel lateral. El **asiento** (formulario con modo vista) ya muestra sus relacionados.
- `DocumentDrawerShell`: retirado el layout simple (`summary`/`children`/`related`, sin consumidores); una sola anatomía.
- Fuera de U5 (registrados sin ficha documental): `sales.salereturn` (tiene página propia `/sales/returns/{id}`), `finance.payment` (formulario de pago).
- **Aviso:** el commit del usuario 9d031204d dejó claves duplicadas en `lib/utils.ts` (12 errores TS1117 en `tsc`); no es parte de este trabajo y no se tocó.

## 2026-10-15 · U4 — puntos de entrada sin Hub

- Migrados a `openEntity` (ficha documental apilada): `ContactDrawer` (OV/OC de la ficha de contacto), `SubscriptionHistoryModal` (OC y notas), `OutsourcingVerificationStep` ("Ver OC"), `WorkOrderWizard` ("Ver orden"), `DeclarationWizard` ("Ver documento" en lugar de "Abrir Hub"), `UnbilledChargesClientView` (OC de cuotas), `TaskInbox` (mapeo puro `documentForTask`: tareas HUB_*, OV_, OC_, NC_/ND_, OT_ → su ficha; las NC_/ND_ abrían el Hub con el id de la nota como si fuera OV).
- Los `onActionSuccess` que se pasaban al Hub (refrescar tareas, historial de suscripción, la OT del asistente, deudas del checkout) pasan a `hooks/useOnEntityStackClose`: se ejecutan al cerrar la pila de fichas.
- `POSShell` ya no se desplaza por el Hub; `useEntityRouteActions` sin `?hub`/`openHub` (sin consumidores).
- Único uso restante: `DashboardShell` lee el estado del Hub para el layout y `app/layout` monta `HubPanelProvider`/`GlobalHubPanel` → se retiran en U6 (inalcanzables: ningún flujo llama `openHub`).
- Tests: `taskDocument.test.ts` (mapeo de tareas); mock del test de `WorkOrderWizard` actualizado. Tests de U3 corridos en el dev server: 7 archivos / 41 tests OK (antes hubo que instalar `@nivo/funnel`, ausente en el `node_modules` del contenedor tras el `npm ci`; instalado con `--no-save`, sin tocar el lockfile).

## 2026-10-15 · U3 — ficha de OC y de factura/nota

- **OC:** `openEntity('purchasing.purchaseorder')` abre `OrderSheet kind="purchase"` (columna "Recibido", sin OT; precio = `unit_cost`, neto). `PurchaseOrderDrawer` eliminado. `GlobalModalProvider` ya no redirige nada al Hub (`HUB_ENTITY_TYPES` retirado).
- **Factura/nota:** nueva `InvoiceSheet` (reemplaza `InvoiceDrawer`, eliminado, y el "modo nota" del Hub): ciclo Origen → **Emisión** (folio; borrador = vacío "Folio pendiente") → Logística → Tesorería (`payment_status`); Resumen = Contexto (contraparte, fecha y hora, documento + folio, origen enlazado: OV/OC o documento corregido) + Productos (`invoiceLineFields`: producto, cantidad, precio neto, subtotal neto) + totales; Relaciones. Acciones del mismo registro y motor que el Hub, acotadas: factura → folio, pago, devolución de pago, NC, ND; nota → folio, pago/reembolso y logística de la nota. Borrador → "Cancelar borrador"; emitida → se corrige con NC/ND (ADR-0084).
- **Netos en líneas de factura:** `InvoiceSelectorExt.get_lines` agrega `subtotal_net`/`unit_price_net` (venta gross-first con reparto exacto de `total_net`; compra ya neta).
- **Listas → ficha:** nuevo `hooks/useDocumentSheetRoute(label)` (`?selected` ↔ pila de `openEntity`, limpia la URL al cerrar). Lo usan `SalesOrdersView` (OV, notas y devoluciones), `PurchasingOrdersClientView` (OC y notas de compra), `SalesInvoicesClientView` y `PurchaseInvoicesClientView`. Las páginas ya no abren el Hub (la de notas abría el Hub con el id de la nota como si fuera OV).
- **POS:** el modo notas también usa la ficha incrustada (`InvoiceSheet embedded`); el POS ya no usa el Hub. `pos/DetailPanel` (consumidor de buckets legacy) eliminado.
- Acciones sobre facturas relacionadas: borrador → cancelar; se quitó "anular documento" de facturas sin folio emitidas (estado imposible tras ADR-0084).

## 2026-10-15 · ADR-0084 — estado del documento desacoplado del pago

Decisión del responsable: opción 1 (desacople completo antes de U3). Detalle en [state-machine-evaluation.md](./state-machine-evaluation.md) §5 y ADR-0084.

**Backend**
- Enums: `Invoice.Status` = DRAFT (folio pendiente) · POSTED (emitida) · CANCELLED; `SaleOrder.Status` = DRAFT · CONFIRMED · PAYMENT_PENDING · CANCELLED; `PurchaseOrder.Status` = DRAFT · CONFIRMED · CANCELLED.
- `payment_status` derivado (`core/payment_status.py`, propiedad en factura/OV/OC, expuesto en serializers): UNPAID · PARTIAL · PAID.
- Escritores eliminados: `TreasuryService` (ya no escribe `PAID`; dispara `on_fully_paid` solo al cruzar el umbral → avance de suscripción de la OC, antes atado a la transición a PAID), `BillingService` y `InvoiceFromLinesService` (ya no escriben INVOICED/PAID en la orden), recepción (ya no escribe RECEIVED), reversión al anular factura (no-op), democión por cheque protestado (no-op).
- Lectores por eje: emitidas = POSTED (libro de ventas, origen de NC/ND, tarea de facturación, filtro de facturación); vigentes = DRAFT + POSTED (total efectivo, facturado BI); filtros de pago de listas OV/OC con `filter_by_payment_status`; nuevo filtro `payment_status` en facturas; `confirm_invoice` solo desde DRAFT; selectores/BI/tareas de crédito/backfill sin estados eliminados.
- `PurchaseOrder.pending_amount` itera `invoices.all()` (prefetch; evitaba un N+1 nuevo en la lista).
- Migraciones `billing/0020`, `sales/0019`, `purchasing/0014` (datos + choices).
- Tests: suite completa = línea base exacta (24 fallos + 5 errores preexistentes, ninguno nuevo); 8 tests adaptados a la semántica nueva; 7 nuevos (`core/tests/test_payment_status_decoupling.py`: borrador pagado sigue DRAFT, OV CONFIRMED + PAID, filtros de lista y de facturas, avance de suscripción solo al cruzar el umbral).

**Frontend**
- Filtros de facturas/notas sin "Pagado" en Estado + filtro "Pago" aparte; tipos (`PaymentStatus`, `SaleOrderStatus`) al modelo nuevo; reglas de pagado del ciclo por `payment_status`; embudo de compras por ejes; tooltip de NC/ND corregido (decía "la orden debe estar pagada", condición que no existía).

**Causa raíz adicional (encontrada al validar el seed):** `create_sale_invoice` creaba por defecto facturas **POSTED sin folio** (186 en un seed nuevo); antes el pago las pasaba a PAID y lo ocultaba. Ahora una factura POSTED exige folio: sin número nace en DRAFT (folio pendiente, asiento en borrador hasta `confirm_invoice`), como el checkout con registro pendiente. `audit_document_integrity` controla "emitidas sin folio = 0". Seed: el lote masivo emite con folio y deja 1 de cada 5 con folio pendiente → seed nuevo: 194 POSTED + 33 DRAFT, auditoría toda en OK.

**Dev server:** respaldo `~/erpgrafico_pre_adr0084_20261015-2013.dump`; migraciones aplicadas: facturas 181 DRAFT + 58 POSTED (0 incoherencias de folio), OV 188 CONFIRMED, OC 50 CONFIRMED.

## 2026-10-15 · Ajustes: OT en productos y factura en borrador

- **OT con "—" en Productos** (OV-000002): `work_order_summary` de la línea no traía `id` ni `display_id`, así que el enlace no podía abrir la OT (en Relaciones sí aparecía, vía el proveedor). `SaleLineSerializer` los incluye.
- **Factura en borrador** (sin folio): el paso Facturación queda **vacío** (neutral, anillo en 0, detalle "Folio pendiente"); solo las facturas emitidas mueven el paso. Facturación parcial o emitidas + borradores = en curso; todo facturado y foliado = completo. Misma regla en tarjeta y ficha (`billingStage`).
- Verificación: vitest 87/87 (órdenes, contrato de color, shared); pytest ventas en verde.

## 2026-10-15 · Ciclo: tarjeta y ficha desincronizadas · evaluación de la máquina de estados

Caso reportado: OV-000004 se veía "Facturado" en la ficha sin folio registrado. Evaluación completa en [state-machine-evaluation.md](./state-machine-evaluation.md).
- **Corregido (frontend):** el punto del botón de acciones usaba `bg-cyan` (CMYK reservado a navegación, ADR-0076; lo detectó `color-system.contract`) → `bg-primary`. Fuente única del ciclo en `lib/workflow-status` (`billingStage`: Facturación completa solo con todo facturado y foliado; "Folio pendiente" en la ficha; ajustado después: un borrador deja el paso vacío); `features/orders/utils/status` reexporta (había dos copias). `stageIntent`: los estados de etapa ya no se resuelven como estados de negocio (`active` se pintaba verde "Activo" en tarjeta y ficha; ahora "en curso" = advertencia).
- **Pendiente de decisión (backend):** `TreasuryService` escribe `status = PAID` en facturas/OV/OC al quedar pagadas → 180 facturas sin folio aparecen "Pagadas"; `Invoice.Status` y `SaleOrder/PurchaseOrder.Status` mezclan emisión, facturación y cobro. Propuesta de desacople (ADR-0084) en la evaluación.

## 2026-10-15 · Piloto U2 — columnas, netos y detalle de relaciones

- **Orden de columnas no aplicado:** `toColumns()` ordena por zona semántica (los importes van a la zona "header"), no por orden de definición. Todos los campos de `orderLineFields` declaran `placement: 'detail'`; test que fija el orden (Producto, Cantidad, Precio unit., Entregado, Facturado, OT, Subtotal).
- **Subtotales con IVA:** la OV es gross-first: `SaleLine.subtotal` y `unit_price` (sin precio bruto aparte) se guardan **con IVA** y el neto solo existe en el documento. Nuevo `allocate_line_nets` (`core/strategies/totals.py`): reparte `total_net` (ya con descuento global) en proporción al bruto con mayor resto → la suma de netos por línea es exactamente `total_net`. `SaleOrderSerializer` expone `subtotal_net` y `unit_price_net` por línea; la tabla y el recuadro de totales los usan. Dev (OV-000002): 500 × 150 bruto = 75.000 → precio neto 126,05 · subtotal neto 63.025 = `total_net`.
- **Relaciones:** el detalle de la fila solo se muestra en Contactos y Tesorería.
- Ruff: imports reordenados en los `relations.py` tocados antes.
- Verificación: pytest relaciones + reparto 15/15; vitest 80/80 (órdenes, documentos, shared/__tests__); `tsc` y ESLint sin errores.

## 2026-10-15 · Piloto U2 — ajustes menores

- Contexto en **una fila** de 4 campos y sin separador (notas recortadas a 2 líneas).
- Productos: **Subtotal como última columna**; precio unitario a la derecha de la cantidad.
- Botón de acciones integrado al lenguaje del Drawer: botón circular ghost `⋮` como el de cierre, tooltip "Acciones · {siguiente paso}", punto (`bg-primary`) si hay un siguiente paso, ítems con el estilo de `DataCell.ActionMenu`.
- Relaciones: **cada fila es un único enlace** a la ficha de la entidad, en **una sola línea** con el icono de la entidad (`getEntityIcon`, registro central), código, tipo, detalle imprescindible truncado, importe y estado; la fecha y el texto completo quedan en el tooltip. Las acciones "⋯" fuera del enlace.
- Verificación: `tsc` y ESLint sin errores; vitest 21/21 (documentos, órdenes, menú de acciones, tabla de relacionados).

## 2026-10-15 · Piloto U2 refinado (referencia para las siguientes fichas)

Pedido del responsable sobre la ficha de la OV:
- **Franja de ciclo** sin Total/Pagado/Saldo/Entregado (redundantes) y "Producción" → **Manufactura**.
- **Acciones**: la barra se reemplaza por un **menú único "Acciones" en la cabecera**, junto al botón de cierre, con **Imprimir** dentro (`DocumentActionsMenu`: siguiente paso · demás acciones · imprimir · destructivas). `DocumentActionBar` eliminado.
- **Resumen**: fuera Condiciones, Ciclo de vida y Número; **Contexto** con fecha **y hora** (hora de `created_at` cuando coincide el día) y notas, todo alineado a la izquierda (causa: `DataCell.Date`/`ContactLink` se centran por defecto). Nueva sección **Productos** con la tabla (Producto, Cantidad, Precio unit. neto, Subtotal neto, Entregado, Facturado, OT) y recuadro de totales a la derecha (Subtotal = Σ subtotales, IVA, Total, Pagado, Saldo pendiente). Tab **Líneas** eliminado.
- **Enlaces con retorno**: producto y OT abren su ficha apilada ("Volver a OV-…"). Para eso la lista abre la OV **a través de la pila de `openEntity`** (antes era un drawer local de la página, sin "volver"), la ficha fija su número en la pila (`setEntityDisplay`) y `inventory.product` acepta abrirse solo con id (`ProductDrawerById`).
- **Relaciones**:
  - Causa de "facturas y pagos en Otros": el backend del dev server (`daphne`, sin autorecarga) seguía con el código anterior a `domain` → el frontend caía al valor por defecto. Reiniciado.
  - Nuevas áreas **Contactos** (cliente/proveedor/contacto del documento y de sus relacionados, una vez cada uno) y **Contabilidad** con los **asientos de los documentos relacionados** (la OV no los referencia directamente): relaciones indirectas del servicio.
  - `DocumentRef` gana `amount` (importe del documento) y `detail` (texto que lo distingue: pago = tipo · medio · ref.; factura = tipo DTE · forma de pago; despacho = líneas · bodega; OT = etapa · descripción; asiento = glosa; contacto = nombre · RUT · email). La fila muestra código + tipo, detalle · fecha, contraparte solo si difiere de la de la ficha, importe y estado.

**Verificación:** pytest `test_document_relations` + `test_document_routes_sync` 15/15 (2 tests nuevos: contactos, asientos indirectos, importe/detalle, filtro por semántica). `tsc` y ESLint sin errores. Vitest 21/21 en documentos, órdenes, menú de acciones y tabla de relacionados. En el dev server (OV-000002): despacho "1 línea · Bodega Taller Central", factura 75.000 "Factura Electrónica · Transferencia", OT "Asignación de Materiales · …", pago 75.000 "Entrante (Cobro/Venta) · Transferencia · ref. …", asientos de factura y pago, cliente con RUT y email.

---

## 2026-10-15 · Etapa UI — U0, U1 y piloto U2 (ficha documental de la OV)

**Decisiones** (D7–D11): piloto en OV, tabs horizontales, un único tab Relaciones agrupado por área, franja de ciclo, POS con vista incrustada. **ADR-0083** (revierte D4 de ADR-0080).

**U0 · Contratos:** nuevo `component-document-sheet.md`; `component-entity-drawers.md` (OV ya no redirige al Hub), `document-relations.md` (campo `domain`, §6 ligado a U6), `component-form-patterns.md` y otros 5 contratos (`FormTabs` → `TabBar`, que es el componente real; regla de tabs horizontales en fichas en Drawer). Índices: ADR README, `docs/README.md`, `CLAUDE.md`.

**U1 · Primitivas**
- Backend: `DocumentType.domain` + `DocumentTypeRegistry.domain()` (default por app, OV/OC = `origin`), expuesto en `DocumentRef`. Test de contrato del orden de áreas.
- Shared: `DocumentDrawerShell` (ciclo, barra de acciones, tabs `underline`, sidebar de actividad, `embedded`, skeleton con forma; layout anterior intacto para despacho/recepción), `DocumentLifecycle` (pasos con `StatusBadge variant="hub"`), `DocumentActionBar` (1 primaria · ≤3 secundarias · "Más", destructivas al final), `DocumentFieldGrid`, `RelatedDocumentRow` con acciones por fila.
- `features/documents`: `DocumentRelationsTab` (agrupa por área en orden de ciclo, totales, acciones por área y estado vacío con acción, filtro por área, errores inline), `resolveRegistryActions` (mismas reglas que `PhaseCard`), `useOpenRelatedDocument`, `useInvalidateDocuments`.
- `features/orders`: `useOrderActionEngine` (motor extraído de `ActionCategory`, sin motor global ni `ref`; `ActionCategory` del Hub delega en él), `useOrderRelatedActions` (anular/cancelar factura, pago, despacho/recepción, devolución y OT con las reglas de las fases), `AnnulPaymentModal` (extraído de `TreasuryPhase`, que lo reutiliza), `getOrderLifecycle` (facturación por `invoicing_status`), `planOrderSheetActions`, `orderLineFields`.

**U2 · Piloto OV**
- `OrderSheet` (tabs Resumen por capas · Líneas con avance de entrega y facturación · Relaciones) abre la OV desde: `openEntity('sales.saleorder')` (registro `ENTITY_DRAWERS`, sin `onSuccess` para no cerrar la pila), la lista `/sales/orders?selected=` (la selección de fila se rige por la URL), la vista previa de `AdvancedSaleOrderSelector` y el POS (incrustada, con `posSessionId`).
- `SaleOrderDrawer` eliminado (0 consumidores).
- **Paridad con el Hub** (16 acciones de la OV): las 13 de registro con modal o ejecución directa pasan por el mismo motor; `view-documents`, `view-deliveries`, `view-work-orders` y `payment-history` las reemplaza el tab Relaciones (cada documento abre su ficha); anular/cancelar la orden va en "Más" con el mismo flujo de impacto (`useCancelOrderFlow`), bloqueado con motivo cuando corresponde; las 7 acciones por documento relacionado de las fases están como acciones de fila.
- OC, facturas y notas siguen en el Hub (U3).

**Verificación:** `tsc --noEmit` y ESLint sin errores en lo tocado. Vitest (dev server): 8 archivos / 96 tests de documentos, órdenes y shared, más ventas/POS/proveedores/`lib`/`_shared`/producción en verde (`WorkOrderWizard` dio un timeout bajo carga y pasa aislado). Pytest `core/tests/test_document_relations.py` 10/10; el resto de `core/tests` falla solo en lo preexistente (baseline financiero, rendimiento, enlaces de docs antiguos). Prueba de humo HTTP: `/sales/orders` y `?selected=` compilan y responden 200. **Pendiente:** recorrido en navegador (la extensión de Chrome no estaba conectada).

---

## 2026-10-15 · Seed (`setup_demo_data`) revisado y dev server re-sembrado

**Evaluación del seed:** casi todo se crea con los servicios, así que con un seed nuevo los datos nacen con los arreglos (líneas de factura, cumplimiento de despachos, enlaces stock↔documento, estado de facturación). Cambios necesarios:
- `_create_sales_purchasing_demo` creaba la factura FACT-1001 con `Invoice.objects.create` (sin líneas propias, sin asiento, sin actualizar la OV) → ahora `BillingService.create_sale_invoice`.
- Purga: `InvoiceLine` antes de las líneas de despacho/recepción (las protege con PROTECT).
- Nueva sección `_create_document_flows_demo` (escenarios D6, solo servicios reales, idempotente y aislada): factura parcial por despacho (OV queda PARCIAL con un segundo despacho sin facturar), factura multi-orden, anticipo de 80.000 repartido 50.000 + 30.000 entre dos facturas, NC sobre línea de factura con devolución física, compra facturada contra una recepción parcial.

**Fallo encontrado al probar el seed en PostgreSQL (los tests en SQLite no lo veían):** `InvoiceFromLinesService` bloqueaba con `select_for_update()` + `select_related("product")`; en ventas `product` es nullable (LEFT JOIN) y PostgreSQL rechaza el FOR UPDATE → **la facturación por entregas de ventas fallaba siempre en PostgreSQL**. Corregido con `select_for_update(of=("self",))`; los tests de M4b fallan 8/8 contra PostgreSQL sin el arreglo y pasan con él.

**Falso positivo corregido:** las "21 recepciones sin movimiento de stock" (30 en un seed nuevo) eran líneas de **suscripciones**, que por diseño no mueven stock; la métrica filtraba por `track_inventory`, que vale True por defecto incluso para servicios. `audit_document_integrity` y `backfill_document_links` excluyen ahora servicios y suscripciones. Con esto **todos los umbrales de integridad quedan en OK**.

**Dev server re-sembrado (2026-10-15, autorizado):** respaldo previo `~/erpgrafico_pre_reseed_20261015-0459.dump` (pg_dump, en el servidor, fuera de la carpeta sincronizada); BD `erpgrafico` borrada y recreada, Redis vaciado, migraciones desde cero, `setup_demo_data` (415 s). Los 5 escenarios documentales creados; auditoría de integridad **todo OK**; el backfill de líneas no encuentra nada que corregir. Resultado: 238 facturas, 181 movimientos de stock, 2 imputaciones de anticipo; OV 186 facturadas + 1 parcial, OC 49 + 1 parcial.

**Validación previa** en una BD PostgreSQL local desechable (migrate desde cero + seed): los 5 escenarios OK; auditoría todo OK; los comandos de backfill no encuentran nada que corregir (los servicios ya generan datos correctos).

## 2026-10-15 · M6 · Retiro y deprecación de lo legacy

Procedimiento: [deprecate-feature.md](../../30-playbooks/deprecate-feature.md) (retirar solo con 0 consumidores; el resto pasa a "Deprecate").

**Retirado:**
- **GFK `TreasuryMovement.allocated_to`** y sus columnas (`allocated_content_type`, `allocated_object_id`, también en el histórico): sin escritores desde siempre, sin lectores desde M4d, **vacías** en el dev server (0 de 248 movimientos, verificado con SELECT). Migración `treasury/0094_remove_treasurymovement_allocated_gfk`, aplicada en el dev server con la confirmación del responsable. Excepción al "periodo de deprecación" del playbook: no hay producción ni consumidores externos.
- **`StockMove.related_documents`** (serializer, selector y tipos del frontend): su único lector era la lista en texto plano del `StockMoveDrawer`, reemplazada en M3 por la tabla de relacionados.
- (`DRAWER_MAP`, en M5.)

**Deprecado (sigue en uso; marcado `DEPRECATED` / `@deprecated`, inventario de consumidores en `document-relations.md` §6):**
- `related_documents` de OV/OC (~23 archivos del frontend: todo el Order Hub, POS, contactos).
- `Invoice.related_documents` / `related_stock_moves` / `related_returns` (Hub en modo nota).
- `JournalEntry.source_documents` (campo de origen y precarga del `JournalEntryDrawer`).
- `SaleOrderDrawer` / `PurchaseOrderDrawer` (detalle propio de `OriginPhase` y `AdvancedSaleOrderSelector`).

**No hecho, con motivo:**
- **Migrar el Order Hub al endpoint de relaciones** (condición para retirar los buckets): son ~3.600 líneas de UI de proceso con lógica de estado sobre los buckets; sin poder probar en navegador el riesgo de regresión es alto. Queda como proyecto propio; el Hub ya muestra la tabla común de relacionados (M3).
- **Derivar `ENTITY_REGISTRY` del endpoint `entity-config`**: se mantiene la copia del frontend, ahora protegida por tests de contrato en ambos lados (rutas canónicas y `detailUrlPattern` con página).

**Verificación:** `makemigrations --check` sin cambios; `treasury inventory billing` + relaciones: sin fallos nuevos frente a la línea base; type-check y lint del frontend sin errores.

---

## 2026-10-15 · M5 · Extensión a todos los módulos, rutas canónicas (GAP-08) y un solo registro de fichas (GAP-12)

**Backfill de líneas de factura aplicado** en el dev server (aprobado): 168 facturas / 173 líneas; idempotente; OV-000001 ya no aparece pendiente de facturar.

**Relaciones en el resto de módulos** (`<app>/relations.py`):
- Producción — OT: OV y nota de origen, despachos que la originaron, OC de servicios tercerizados, consumos de stock.
- Ventas/compras — devoluciones: orden, NC asociada, movimientos de stock, asiento.
- Tesorería — cheque (factura/OV que paga, movimientos de recepción y depósito), lote de terminal (pagos, liquidación, factura del proveedor, asiento); movimiento de tesorería suma cheque, lote y liquidación de sueldo.
- RRHH — liquidación: pagos y asientos (sueldo y Previred).

**GAP-08 — rutas canónicas sin rutas rotas:**
- Todo tipo registrado en `UniversalRegistry` tiene URL canónica declarada (con ruta verificada) **o** ficha en `ENTITY_DRAWERS` para el resolvedor `/d/{label}/{id}`. Declarados para los 15 tipos sin ficha (presupuesto, ejercicio, conceptos de nómina, suscripción, BOM, devolución de venta, F29/periodo, centro bancario, medios de pago, transacciones de socios).
- **Búsqueda global**: `detail_url` = URL canónica (`DocumentTypeRegistry.url_for`); antes usaba `detail_url_pattern`, con 29 patrones sin ruta (la búsqueda fallaba en 7 tipos).
- Frontend: 23 `detailUrlPattern` de `ENTITY_REGISTRY` apuntaban a páginas inexistentes (p. ej. `/sales/deliveries/{id}`, `/purchasing/receipts/{id}`, `/tax/declarations/{id}`); corregidos a la ruta real o al resolvedor.
- e2e `universal-search-routes.spec.ts`: el despacho simulaba `/sales/deliveries/800` (ruta inexistente que el backend nunca emitía); ahora espera `/d/sales.saledelivery/800`. **No ejecutado** (Playwright requiere navegador y sesión).
- Tests de contrato: `core/tests/test_document_routes_sync.py` (URL canónica o ficha para todo tipo; búsqueda) y `frontend/lib/__tests__/entity-registry-routes.contract.test.ts` (todo `detailUrlPattern` tiene página).

**GAP-12 — un solo registro de fichas:** `DRAWER_MAP` retirado; `LazyDrawer` (8 vistas) renderiza las fichas de `ENTITY_DRAWERS` a partir del `docType` legacy. Esto corrige de paso:
- **Asiento** abierto desde esas vistas: se pasaba `id`, que `JournalEntryDrawer` ignora → abría el **formulario de creación**.
- **Pago** (`finance.payment`) abierto por id desde `ENTITY_DRAWERS`: también abría creación; el adaptador ahora pasa `id` en modo vista.

**Hallazgo y corrección de infraestructura de tests:** `NoteWorkflow` vive en `billing/note_workflow.py`, que `billing/models.py` no importaba; con `--nomigrations` su tabla solo se creaba si otro módulo lo importaba antes de crear la BD de test ("no such table" según el orden). Ahora se registra desde `billing/models.py` (sin cambios de migraciones).

**Corrección encontrada al verificar en el dev server — búsqueda global rota en PostgreSQL:** `GlobalSearchIndex.search_vector` usa el campo propio `core/db_compat.SearchVectorField` (para poder testear en SQLite), que no registraba el lookup de búsqueda de texto de Django; `filter(search_vector=SearchQuery(...))` compilaba a `tsvector = tsquery` → `ProgrammingError` en **toda** búsqueda (preexistente). Se registra `SearchVectorExact` en el campo; verificado en el dev server (OV → `/sales/orders?selected=…`, despacho/OT → `/d/…`). Test `core/tests/test_search_postgres.py` (solo PostgreSQL; ejecutado contra PostgreSQL local: rojo sin el arreglo, verde con él).

**D6 — devoluciones:** escenario con el flujo real (`ReturnService.create_return_from_note_request` + `confirm_return`): la devolución enlaza OV, NC y el movimiento que repone stock; la OV la lista como corrección. Escenario de OT ↔ OV.

**Verificación:** backend `billing sales purchasing treasury core workflow inventory production accounting hr tax contacts`: 656 passed, sin fallos nuevos (el fallo de `contacts/test_p23_credit_portfolio_task` es preexistente: se reprodujo en un worktree del commit anterior). Frontend: suite completa en el dev server, solo falla `semantic-ink` (preexistente, ambiental); type-check y lint sin errores.

**Pendiente (M6):** retirar formatos legacy (`related_documents`, `Invoice.related_documents`, `source_documents`), drawers delgados de OV/OC y columnas del GFK `allocated_to` (destructivo, con confirmación); derivar `ENTITY_REGISTRY` del endpoint `entity-config` (hoy se mantienen sincronizados por tests). P2 diferidos: GAP-15 (FK de línea en devoluciones), GAP-16…19.

---

## 2026-10-15 · M4d · Pagos: regla única de reparto (GAP-04 b/c)

**Problemas encontrados (E, tests):**
- **Doble conteo:** un pago con FK a una factura y además imputaciones (`PaymentAllocation`) a esa misma factura se contaba dos veces (FK completa + imputación).
- **Otro cálculo divergente de "pagado":** `TreasuryService.update_related_document_status` marcaba la factura/orden como PAGADA con la suma bruta de los pagos por FK — **incluidos los anulados** y las devoluciones como positivas.
- El GFK `allocated_to` (sin escritores) se seguía leyendo en 3 sitios.

**Regla implementada** (`treasury/selectors.py` `PaymentSelector.paid_amount`): cada movimiento se reparte **una sola vez** — sus imputaciones explícitas y, para su documento de la FK, el resto.
- Factura: pagos por FK aportan `importe − Σ sus imputaciones` + imputaciones a la factura (de cualquier pago).
- Orden: pagos por FK aportan el importe completo (sus imputaciones a facturas de la misma orden siguen dentro de la orden: anticipos repartidos, D2) + imputaciones directas desde pagos **sin** esa FK.
- Signo por dirección también para imputaciones; anulados excluidos.
- `update_related_document_status` usa `total_paid` del documento (misma regla).
- GFK `allocated_to`: retiradas las 3 lecturas (fase 1). La eliminación de las columnas es destructiva → fase 2 en M6, con confirmación.
- Prefetch `payments__allocations` / `payment_allocations__treasury_movement` en los querysets de facturas, OV y OC (sin N+1 nuevo).

**Desviación respecto del plan (aceptada por el responsable el 2026-10-15):** el plan proponía copiar cada FK de pago a una `PaymentAllocation` (backfill de ~248 movimientos) para que la tabla fuera la única representación física. Con la regla anterior la FK y la imputación conviven sin ambigüedad (la imputación manda; la FK recibe el resto), por lo que **no se copiaron datos**. La FK sigue siendo la forma simple de "un pago → un documento" y `PaymentAllocation` la de repartos (anticipos en facturas parciales, pagos a varias facturas). Si se prefiere la representación física única, el backfill sigue el patrón D3.

**Verificación:** `treasury/tests/test_payment_selector.py` (+2: reparto sin doble conteo entre FK e imputaciones a A y B; pago anulado no marca PAGADA) — fallan con el código anterior. Suites backend: 628 passed, sin fallos nuevos. En el dev server hay 0 `PaymentAllocation`, por lo que los saldos mostrados no cambian.

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

**Backfill** `python manage.py backfill_invoice_lines [--apply]` (dry-run por defecto, D3). **Aplicado en el dev server el 2026-10-15** (resultado idéntico al dry-run, segunda ejecución sin cambios; OV-000001 ya no aparece como pendiente de facturar). **Dry-run previo:** 168 facturas → 173 líneas espejo; OV: 128 `INVOICED`; OC: 40 `INVOICED`, 3 `PENDING`; ninguna orden facturada por sobre lo pedido. **Pendiente de aprobación.** Mientras no se aplique, las facturas antiguas se leen por el camino legacy.

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
