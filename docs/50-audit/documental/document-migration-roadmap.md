# Brechas y plan de migración — Fase 5

> Entregable 5 · 2026-10-14 · Plan, **no ejecutado**. Referencias: INT-* = [integridad](./document-integrity-findings.md), R* = [matriz](./document-relations-matrix.md), §= [arquitectura objetivo](./target-document-architecture.md).
> Esfuerzo relativo: S (≤1 día) · M (2-4 días) · L (1-2 semanas). Tipo: **UI** solo UI · **SVC** servicios comunes · **MOD** modelos/consultas · **MIG** migración de datos · **REG** reglas de negocio.

## 1. Registro priorizado de brechas

### P0 — integridad (bloquea resolver relaciones)

**GAP-01 · Cumplimiento de despacho no registrado** — INT-01 · Tipo: REG+MIG · Esfuerzo M
- Evidencia: `sales/services.py:706-711`; E; D 107/132.
- Afecta: ventas, notas de crédito, estado de entrega OV.
- Causa raíz: incremento dentro de la rama `else` con variable de bucle residual.
- Solución: incrementar `quantity_delivered` por cada línea del despacho tras confirmar (como compras `purchasing/services.py:499`); recalcular `_update_order_delivery_status`.
- Datos: backfill `quantity_delivered = Σ SaleDeliveryLine.quantity` de despachos CONFIRMED por línea (excluyendo anulados). Decisión **D3**: comando con `--dry-run` por defecto que lista las OV que cambiarían de estado; se aplica solo tras aprobación.
- UI: ninguna. Dependencias: ninguna.
- Riesgos: OV hoy forzadas a DELIVERED por `dispatch_order` podrían reclasificarse a PARTIAL si los datos están incompletos; revisar antes de aplicar.
- Aceptación: test que confirme 2 líneas inventariables → `quantity_delivered` = cantidades; consulta de dev: 0 líneas de OV DELIVERED con 0 entregado.
- Reversión: migración de datos reversible (guardar valores previos en tabla temporal / `simple_history`).

**GAP-02 · Línea de despacho/recepción sin StockMove** — INT-02 · REG+MIG · M
- Evidencia: `sales/services.py:686-703`, `inventory/services.py:175`; E; D 83/83, 21/34.
- Causa raíz: emparejamiento heurístico `(product_id, -qty)` vs `abs(qty)`; el detalle de inventario no conoce su línea origen.
- Solución: crear el `InventoryDocumentDetail` con referencia a la línea origen (o devolver moves en el mismo orden que los detalles) y enlazar 1:1; **corregir el test** `test_p24_confirm_delivery.py:111-112` que fija el bug.
- Datos: backfill por (despacho, producto, fecha, cantidad absoluta) solo cuando sea unívoco; los ambiguos se reportan.
- Aceptación: 0 líneas confirmadas inventariables sin `stock_move` en nuevos despachos; informe de ambiguos del backfill.
- Reversión: FK nullable; el backfill se revierte poniendo NULL a los enlazados en el lote.

**GAP-03 · StockMove sin documento** — INT-03, INT-04 · MOD+MIG · M · depende de GAP-02
- Solución: FK `StockMove.inventory_document` (nullable) poblada en `confirmar_documento`; `InventoryDocument.source_document_*` del despacho/recepción apunta al despacho/recepción.
- Datos: backfill desde `description` (`"<tipo> Doc: <ref|id>"`) donde parsee; PGFK de despacho recalculada desde el asiento del despacho (`JournalEntry.source_document`).
- Aceptación: % StockMove con back-link tipado o documento ≥ 95 % en dev (hoy 10 %).
- Reversión: columna nullable; eliminar sin pérdida.

**GAP-04 · Pago→documento con 3 representaciones y saldos divergentes** — INT-06 · REG+MOD+MIG · L
- Evidencia: `treasury/models.py:202-221,2343`; `billing/models.py:181`; `billing/serializers.py:82`; D 0 allocations / 0 GFK.
- Solución: (a) **inmediato (S)**: un selector único `PaymentSelector.paid_amount(doc)` que excluye `CANCELLED`, corrige `TreasuryMovement.Status` → `MovementStatus`, y es usado por modelo y serializers; (b) fuente única `PaymentAllocation`: backfill 1 allocation por movimiento con FK (factura si existe, si no orden); orquestador escribe allocation; FK legacy se mantienen como lectura; (c) eliminar GFK `allocated_to` y sus 3 lecturas (`treasury/services.py:290,346,430`).
- Regla (decisión **D2**, [decisiones](./document-decisions.md)): imputación a la factura cuando existe; el anticipo no facturado sigue imputado a la orden; la orden se deriva vía factura. Backfill de los 127 casos con `invoice`+`sale_order`: 1 allocation a la factura, ninguna a la orden. Con D1 (facturas parciales y multi-orden) la allocation **con importe** es obligatoria → (b)(c) se ejecutan junto con GAP-13 en M4.
- Aceptación: pendiente de OV/factura idéntico entre modelo, serializer y Hub en dataset de prueba con pagos anulados y parciales.
- Reversión: (a) trivial; (b) allocations creadas por backfill marcadas (`notes='backfill-GAP04'`) y borrables.

**GAP-05 · GFK `Invoice.source_order` muerto con lógica dependiente** — INT-05 · REG · S
- Solución: reemplazar `invoice.source_order` por `invoice.sale_order or invoice.purchase_order` en `billing/services.py:1451,1477,1491` y `billing/models.py:196-209`; después retirar el GFK (migración que elimina columnas, sin datos útiles: D 168/168 NULL).
- Aceptación: tests de `post_invoice` verifican validación de folio por proveedor, glosa y `sync_hub_tasks`.
- Reversión: revertir commit; la retirada de columnas va en release posterior.

### P1 — navegación coherente

**GAP-06 · Drawers de despacho/recepción abren otra entidad** — INT-12 · UI+SVC · M
- Evidencia: `lib/entity-drawers.tsx:481,550`; `drawerRegistry.tsx:12-13`.
- Solución: `SaleDeliveryDrawer` / `PurchaseReceiptDrawer` (vista) sobre endpoints `sales/deliveries/{id}` y `purchasing/receipts/{id}`; registrar en `ENTITY_DRAWERS`.
- Aceptación: `openEntity('sales.saledelivery', id)` muestra `DES-…` del id dado.

**GAP-07 · Hub de compras lista StockMoves como recepciones y anula por id de StockMove** — UI+SVC · S · **riesgo de anular documento equivocado**
- Evidencia: `purchasing/selectors.py:99-118`; `LogisticsPhase.tsx:136-137`; `useOrdersMutations.ts:114`.
- Solución: `receipts` devuelve recepciones (`id` de PurchaseReceipt, `docType:'purchase_receipt'`) como hace ventas; incluir recepciones sin `stock_move`.
- Aceptación: test de selector + test de componente que verifica el id enviado a `annulPurchaseReceipt`.
- Prioridad sugerida: **hotfix previo al plan**.

**GAP-08 · Registro de identidad/rutas fragmentado (7 registros, 29 rutas rotas)** — SVC+UI · L
- Solución: `UniversalRegistry` extendido (§1) como fuente; `entity-config` incluye `canonical_url`, `drawer_key`; FE deriva `ENTITY_REGISTRY` URLs, `searchableEntityRoutes`, `TYPE_TO_REGISTRY`; test de sincronía (ya existe `core/tests/test_prefix_sync.py` como patrón) que falle si un `detail_url_pattern` no tiene ruta.
- Aceptación: script de cruce (rutas vs registro) = 0 "NO ROUTE"; búsqueda global e2e contra backend real.

**GAP-09 · Contrato de relaciones** — SVC · L · depende de GAP-01..05 para el piloto
- Solución: §2 (`DocumentRef`, `DocumentLink`, providers, endpoint); adaptadores sobre selectores actuales.
- Aceptación: endpoint devuelve, para el piloto, todas las relaciones R1, R3, R6, R7, R21/R23, R28/R29 con `unresolved` vacío.

**GAP-10 · Ficha común + tabla de relacionados** — UI · M · depende de GAP-09
- Solución: `DocumentDrawerShell` + `RelatedDocumentsTable` + `useDocumentRelations`; adoptar en drawers del piloto.

**GAP-11 · Sin navegación de vuelta ni contexto** — UI · S-M
- Solución: pila en `GlobalModalProvider`; prop `via`; banner de origen.

**GAP-12 · `DRAWER_MAP`/`LazyDrawer` duplicado** — UI · S · depende de GAP-06
- Solución: Hub usa `openEntity`; eliminar `DRAWER_MAP` cuando 0 consumidores (8 archivos).

**GAP-13 · Factura sin líneas propias** — INT-07 · REG+MOD+MIG · L · **promovida de P2 a P1 por la decisión D1**
- Motivo: la imprenta usa las tres modalidades (1 factura por orden, varias facturas por orden y 1 factura para varias órdenes); la última no es representable hoy y la segunda no puede expresar qué parte de la orden factura.
- Solución: `InvoiceLine` propia **por cantidad** (D1.1) con FK a la línea de orden y FK a la línea de entrega, obligatoria en facturas parciales de productos entregables (D1.2); `quantity_invoiced` en la línea de orden; `invoicing_status` PENDING/PARTIAL/INVOICED en la orden (D1.4); factura ↔ orden N:M **derivada de las líneas**; `Invoice.sale_order`/`purchase_order` se conservan como orden principal (nullable). Requiere ADR propio.
- Dependencias: GAP-01/GAP-02 (la factura parcial se valida contra lo realmente entregado).
- Datos: backfill de líneas espejo para cada factura existente (todas son 1:1 hoy), con dry-run (D3).
- Aceptación: escenarios D6 (2 facturas/1 OV, 1 factura/2 OV, anticipo repartido) con relaciones resueltas y saldos coherentes.
- Detalle: [decisiones §D1](./document-decisions.md).

**GAP-14 · Líneas de NC/ND en la tabla de pedido** — INT-08 · REG+MOD+MIG · L · **promovida a P1 por D1.3**
- Solución: las líneas de NC/ND referencian `InvoiceLine` (no `SaleLine`/`PurchaseLine` vía `related_note`); validación de lo acreditado ≤ lo facturado por línea.
- Dependencias: GAP-13; escenarios D6 de notas (hoy 0 datos en dev).

### P2 — diferibles

| ID | Brecha | Tipo | Esf. |
|---|---|---|---|
| GAP-15 | Devoluciones sin FK a línea origen (INT-09) | MOD+MIG | M |
| GAP-16 | `Transition` solo 5 tipos; eventos de relación en historial (INT-13) | SVC | M |
| GAP-17 | Prefijo `DEV` compartido; asiento con numeración propia | REG | S |
| GAP-18 | Labels FE sin modelo (`finance.payment`, `pos.session`…) | UI | M |
| GAP-19 | 21 asientos automáticos sin origen (INT-11) | SVC | S |

## 2. Clasificación por tipo de cambio

| Solo UI | Servicios comunes | Modelos/consultas | Migración de datos | Reglas de negocio |
|---|---|---|---|---|
| GAP-10, 11, 12, 18 | GAP-06, 07, 08, 09, 16, 19 | GAP-03, 04, 15 | GAP-01, 02, 03, 04, 13, 14 | GAP-01, 02, 04, 05, 13, 14, 17 |

## 3. Flujo piloto: **Venta — OV → Despacho → Factura → Pago (+ asientos y stock)**

Por qué (evidencia):
- Es el flujo con más datos reales (dev: 128 despachos, 168 facturas, 248 movimientos de tesorería, 84 asientos de despacho).
- Concentra las relaciones rotas más graves (INT-01, 02, 04, 05, 06) → valida que la capa resuelve persistencia real, no un caso feliz.
- Ya tiene la mejor UI de proceso (Order Hub) para comparar antes/después.
- Compras es simétrico (R15-R18) y se migra después reutilizando providers.
- Notas/devoluciones quedan fuera: 0 datos en dev para validar.

## 4. Estrategia incremental

| Fase | Contenido | Preserva funcionamiento | Sale cuando |
|---|---|---|---|
| **M0 Hotfix** | GAP-07, GAP-04(a), GAP-05 | sí, cambios locales | tests verdes + check manual Hub compras |
| **M1 Integridad del piloto** | GAP-01, GAP-02, GAP-03 (+ backfills con dry-run y aprobación, D3); comando de solo lectura `audit_document_integrity` (D5) | sí, FKs nullable | criterios de aceptación GAP-01..03 en dev |
| **M2 Contratos** | ADR-0080; `DocumentRef`; registro extendido; endpoint relations con providers de ventas (factura ↔ orden como N:M desde el inicio, D1); contrato de ficha con el Hub como ficha de OV/OC (D4); GAP-08 parcial (labels del piloto) | aditivo; formatos viejos intactos | endpoint completo para piloto, `unresolved` vacío |
| **M3 UI piloto** | GAP-06, GAP-10, GAP-11 en despacho, factura, pago, asiento, stock move; `openEntity` de OV/OC abre el Hub y el Hub consume relations (D4) | Hub y drawers viejos siguen disponibles | criterios §5 |
| **M4 Facturación y pagos** | ADR de facturación; escenarios D6 de facturación y notas; GAP-13; GAP-14; GAP-04(b)(c) | FK legacy como lectura / orden principal | saldos idénticos en las 3 vistas; escenarios D1/D2 resueltos |
| **M5 Extensión** | Compras, producción, tesorería, inventario; GAP-12, GAP-08 completo; escenarios D6 de devoluciones antes de GAP-15 | por módulo | cada módulo pasa §5 |
| **M6 Retiro** | Eliminar `related_documents` legacy, `DRAWER_MAP`, GFK `allocated_to`/`source_order`, mapas FE duplicados, `SaleOrderDrawer`/`PurchaseOrderDrawer` (D4) | — | grep de consumidores = 0 y 1 release sin uso |
| **Diferido** | P2 (GAP-15…19) | — | decisión de negocio |

## 5. Criterios de aceptación verificables

**Modelo documental**
- Todo label registrado tiene `display_id`, `canonical_url` con ruta existente (script de cruce = 0 fallos) y drawer o URL.

**Relaciones**
- Para N OV de prueba: `relations` lista sus despachos, facturas, pagos, OT, asientos, stock moves; cada `target.exists = true`.
- Consultas de integridad (las de este informe, scratchpad `integrity_counts.py`) en dev: líneas de despacho inventariables sin stock_move = 0 (nuevas); OV DELIVERED con 0 entregado = 0; StockMove sin documento ≤ 5 %.
- Pagado/pendiente idéntico en modelo, serializer y Hub, excluyendo anulados.

**Fichas**
- Drawers del piloto usan `DocumentDrawerShell`; cada uno muestra la tabla de relacionados con rol, estado y fecha; `loading/empty/error` cubiertos.

**Navegación**
- Desde OV se llega a despacho → stock move → asiento y se vuelve a la OV con "volver" sin cerrar el contexto (test de componente sobre la pila).
- Búsqueda global abre el documento correcto para todos los labels del piloto (e2e contra backend, sin mock de `detail_url`).
- DoD del repo: `npm run type-check`, `npm run lint`, pytest de apps tocadas.
