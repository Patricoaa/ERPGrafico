# Auditoría de UI documental y navegabilidad — Fase 3

> Entregable 3 · 2026-10-14 · Análisis estático del código frontend (no se ejecutaron flujos en navegador; sin métricas de clics).
> Evidencia: **C** código · **E/D** ver [document-integrity-findings.md](./document-integrity-findings.md).

## 1. Superficies de "ficha" existentes

No existe ficha documental común ni páginas de detalle con contenido (ADR-0020 las eliminó). Un mismo documento se presenta en **superficies distintas según el punto de entrada**:

| Documento | `?selected=` en su lista | `openEntity(label)` (ENTITY_DRAWERS) | Order Hub `openDetails(docType)` (DRAWER_MAP) |
|---|---|---|---|
| Orden de venta | **Order Hub** (`app/(dashboard)/sales/orders/SalesOrdersPageClient.tsx:27-28`) | `SaleOrderDrawer` (115 líneas: estado, totales, líneas; **sin relacionados**) | `SaleOrderDrawer` |
| Orden de compra | Order Hub | `PurchaseOrderDrawer` (sin relacionados) | `PurchaseOrderDrawer` |
| Factura | Hub (`billing/sales`) / router `billing/invoices/[id]` | `InvoiceDrawer` (sin relacionados) | `InvoiceDrawer` |
| Despacho | — (ruta inexistente) | `InventoryDocumentDrawer` con id de despacho → **entidad equivocada** (`lib/entity-drawers.tsx:550`) | ídem (`features/_shared/transaction-drawer/drawerRegistry.tsx:12`) |
| Recepción | — | ídem (`entity-drawers.tsx:481`) | Hub de compras lista **StockMoves** como "Recepción" (`purchasing/selectors.py:107-112`, `docType:"inventory"`) → `DRAWER_MAP` no tiene `inventory` → **clic sin efecto** (`drawerRegistry.tsx:32-33`) |
| Movimiento de stock | `?selected` en lista | `StockMoveDrawer`: relacionados como **texto plano** (`StockMoveDrawer.tsx:92-101`) | `stock_move` |
| Asiento | `?selected` | `JournalEntryDrawer`: **único** drawer con `SourceDocumentLink` navegable | `journal_entry` |
| OT | `?selected` | `WorkOrderWizard` (953 líneas, UI de proceso) | `openEntity('production.workorder')` (`OrderHubPanel.tsx:59-61`) |
| Pago | — | `finance.payment` → `PaymentDrawer` (label FE sin modelo) | `payment` |

Composición común reutilizable (C): `Drawer` + `useDrawerIdentity` + `FormSplitLayout` + `ActivitySidebar` (historial simple_history) + `StatusBadge` + `PrintableLayout`. Ningún drawer tiene sección "Documentos relacionados" estándar.

## 2. Order Hub (`features/orders`)

- Ficha de proceso por fases: Origen → Facturación → Producción → Logística → Tesorería (`OrderHubView.tsx`, `phases/*.tsx`, ~3.600 líneas). Es la **única UI que muestra el grafo** OV/OC ↔ factura ↔ OT ↔ despacho ↔ pago.
- Datos: `hooks/useOrderHubData.ts:20-46` (orden o factura + orden); consume `related_documents` (dict por buckets, ver grafo §C).
- Apertura: `openHub` desde 13 archivos (listas de OV/OC/facturas/notas, TaskInbox, POS, Contactos, OT, F29, tarjetas).
- Problemas (C):
  - Despachos/recepciones llegan con ids heterogéneos; en compras la acción **"Anular Recepción" envía el id de un StockMove** a `annulPurchaseReceipt` (`LogisticsPhase.tsx:136-137` → `features/orders/hooks/useOrdersMutations.ts:114`).
  - Recepciones cuya línea no tiene `stock_move` (21/34 en dev, D) **no aparecen** en el Hub.
  - Un solo nivel: el drawer abierto desde el Hub es estado local (`OrderHubPanel.tsx:56-68`); desde ese drawer no hay relaciones navegables.

## 3. Registros de navegación paralelos (7)

| Clave | Registro | Archivo |
|---|---|---|
| `app.model` | `ENTITY_REGISTRY` (URL, icono) | `lib/entity-registry.ts` |
| `app.model` | `ENTITY_DRAWERS` (opener global) | `lib/entity-drawers.tsx` |
| `app.model` | `searchableEntityRoutes` (redirects `[id]`) | `lib/searchableEntityRoutes.ts` |
| `app.model` | `UniversalRegistry.detail_url_pattern` (búsqueda) | `backend/*/apps.py` |
| snake `docType` | `DRAWER_MAP` / `LazyDrawer` (Hub, 8 archivos) | `features/_shared/transaction-drawer/drawerRegistry.tsx` |
| snake → label | `TYPE_TO_REGISTRY` (incl. `inventory → inventory.stockmove`) | `features/_shared/transaction-drawer/types.ts` |
| snake | `ActivitySidebar.entityType` (36 valores) | `features/audit/components/ActivitySidebar.tsx:25` |

Más mapas legacy: `DataCell.Entity type` (`components/shared/DataTableCells.tsx:69`), `lib/utils.ts:477`.

## 4. Recorridos documentales (estáticos)

| Recorrido | Implementación | Resultado |
|---|---|---|
| Lista OV → OV → facturas | fila → `?selected` → Hub → BillingPhase → `InvoiceDrawer` | OK (2 superficies) |
| OV → despacho | Hub → LogisticsPhase → `sale_delivery` → `InventoryDocumentDrawer(id=despacho)` | **Roto** (entidad equivocada) |
| OV → movimientos de stock | Hub muestra moves solo si no hay despachos (`LogisticsPhase.tsx:143`); y `stock_move` del despacho es NULL (INT-02) | **Ausente** |
| Factura → OV | `InvoiceDrawer` sin relacionados; Hub por factura (`useOrderHubData` con `invoiceId`) | Solo vía Hub |
| Factura → NC/ND | `Invoice.related_documents` con `type:'credit_note'` + URL `/billing/sales/{id}` (redirect) | Navega a otra lista (pierde contexto) |
| Asiento → documento origen | `JournalEntryDrawer` → `SourceDocumentLink` → `openEntity` | OK si label tiene drawer; reemplaza el asiento (sin "volver") |
| Movimiento de stock → origen | texto plano | **No navegable** |
| Documento → asiento | NV en drawers comerciales (no se encontró enlace) | Ausente/NV |
| Búsqueda global → documento | `router.push(detail_url)` del backend (`components/shared/UniversalSearch.tsx:101,112`) | Roto para 7 labels con ruta inexistente (despacho, mov. tesorería, cuenta tesorería, doc. inventario, BOM, inasistencia, anticipo); e2e simula `/sales/deliveries/800` ≠ backend `/sales/orders/deliveries/{id}` (`e2e/universal-search-routes.spec.ts:41`) |

## 5. Evaluación de patrones (3.3)

| Patrón | Clasificación | Evidencia |
|---|---|---|
| `openEntity` + `ENTITY_DRAWERS` | Correcto y reutilizable, **incompleto** (37 labels, 2 mal cableados) | `lib/entity-drawers.tsx` |
| `SourceDocumentLink` | Correcto y reutilizable, infrautilizado (2 archivos) | `components/shared/SourceDocumentLink.tsx` |
| `EntityBadge` / `DataCell.Entity` | Correcto (drawer → Link fallback) | `EntityBadge.tsx:60-105` |
| `?selected=` deep link | Funcional pero inconsistente (OV/OC abren Hub, resto drawer; 29 patrones sin ruta) | ver inventario §5 |
| Order Hub | Funcional, duplicado (DRAWER_MAP), acoplado a OV/OC/factura | §2 |
| `LazyDrawer` / `DRAWER_MAP` | Duplicado de `ENTITY_DRAWERS` | `drawerRegistry.tsx` |
| Navegación de vuelta | **Ausente**: `openedEntity` es un único slot (`GlobalModalProvider.tsx:41,54`); Hub también (`HubPanelProvider.tsx:38`) | C |
| Preservación de contexto | Incompleta: abrir relacionado reemplaza el drawer; enlaces con `url` navegan a otra lista | C |
| Breadcrumbs | No aplicados a documentos (4 archivos, layout de módulo) | C |
| Búsqueda global | Funcional, inconsistente (rutas backend rotas) | §4 |
| Historial | Correcto y reutilizable (`ActivitySidebar`), sin eventos de relación (creación de derivados) | C |
| Listados de relacionados | Duplicado/incompatible (3 formatos backend; solo Hub y asiento los renderizan) | grafo §C |
| Acciones contextuales | Centralizadas en Hub (`ActionCategory`, `actions.tsx` de ventas/compras) | NV en detalle |

## 6. Experiencia contextual (3.4)

| Pregunta | Dónde se pierde |
|---|---|
| ¿Qué documento es? | Bien (identidad vía `useDrawerIdentity`/`EntityBadge`) salvo despacho/recepción (muestra otro documento) |
| ¿Por qué está relacionado / qué relación? | No hay campo de relación: los buckets del Hub implican la semántica; `related_documents` de factura/stock usa `type` sin rol |
| ¿Estado? | Presente en Hub y drawers (`StatusBadge`) |
| ¿Qué operación lo originó? | Solo el asiento expone origen (`source_documents`); InventoryDocument tiene PGFK no mostrado navegable |
| ¿Cómo regresar? | No existe: un solo slot de drawer; navegación por `url` abandona el contexto |

## 7. Limitaciones

- No se ejecutó la UI; los flujos son reconstrucción estática.
- No se revisaron en detalle `ActionCategory.tsx`, `features/sales/actions.tsx`, `features/purchasing/actions.tsx` (acciones), ni todos los drawers de tesorería/RRHH.
