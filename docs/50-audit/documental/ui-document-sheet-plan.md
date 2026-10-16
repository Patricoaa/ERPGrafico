# Etapa UI — Ficha documental y retiro del Order Hub

**Estado:** Aprobado (D7–D11, ADR-0083) · **U0–U6 implementadas** 2026-10-15 · ver [implementation-progress.md](./implementation-progress.md)
**Rama:** `feat/document-system`
**Prerrequisitos cumplidos:** M0–M6 (ADR-0080, ADR-0081), relaciones vía `GET /api/core/documents/{label}/{id}/relations/`.

Objetivo pedido:
1. Usar una **ficha documental/entidad** común.
2. **Prescindir por completo del Hub de mando**; sus conexiones y acciones viven dentro de la ficha.
3. Un **tab reutilizable de Relaciones** con todas las relaciones entre entidades y documentos.
4. Reordenar la información de cada documento con las primitivas de jerarquía del sistema (tabs, secciones, subsecciones).

Design read: superficie de producto ERP densa para operadores administrativos de una imprenta (PYME), con el lenguaje CMYK de `DESIGN.md` (K100 como primario, cyan de énfasis), compacta y sin decoración. Dials: VARIANCE 3 · MOTION 2 · DENSITY 7. La skill de taste se aplica solo en sus principios transversales: estados completos, densidad sin tarjetas anidadas, números tabulares en mono y una sola acción primaria por superficie.

---

## 1. Hallazgos de la auditoría

### 1.1 El Hub hoy

| Pieza | Líneas | Qué hace |
|---|---|---|
| `GlobalHubPanel` + `HubPanelProvider` | 186 | Panel global de 320 px (`CollapsibleSheet` "HUB", a la derecha). Monta además un **motor de acciones headless** oculto (`sr-only`), que se dispara por `ref` (`triggerAction`). |
| `OrderHubPanel` + `OrderHeaderDashboard` + `HubStatus` | 589 | Cabecera con KPI y progreso por fases. |
| `OrderHubView` + 5 phases + `PhaseCard` | 1.707 | Cinco acordeones (Origen, Facturación, Tesorería, Producción, Logística). Cada uno lista sus documentos (desde los buckets `related_documents`, deprecados) y sus botones de acción. |
| `ActionCategory` + `ActionButton` | 681 | Motor de acciones: disponibilidad, permisos y host de 13 modales lazy. |
| Modales propios (`DocumentListModal`, `PaymentHistoryModal`, `NoteLogisticsModal`) | 507 | Listas de documentos e historial de pagos. Ambos los reemplaza el tab Relaciones. |
| Hooks (`useOrderHubData`, `useOrdersMutations`, `useCancelOrderFlow`) | 542 | Carga de OV/OC o factura y anulación. |

**Registro de acciones** (`features/sales/actions.tsx`, `features/purchasing/actions.tsx`). Es agnóstico de la superficie y se reutiliza tal cual:

| Categoría | Acciones (OV · OC) |
|---|---|
| Documentos | `complete-folio`, `invoice-by-lines`, `view-documents`, `regenerate-document` (OV) |
| Producción | `create-work-order`, `view-work-orders` (OV) |
| Despachos / Recepciones | `register-delivery` / `register-reception`, `confirm-service-delivery`, `register-merchandise-return`, `view-deliveries` / `view-receptions` |
| Pagos | `register-payment`, `register-payment-return`, `payment-history` |
| Notas | `create-credit-note`, `create-debit-note` |
| Gestión | anular/cancelar (`useCancelOrderFlow`) |

**Modo nota.** El Hub abierto con `invoiceId` sobre una NC/ND oculta Producción y calcula la logística de la nota.

**Puntos de entrada.**
- 23 usos de `openHub`/`useHubPanel` (páginas de facturas, OV, OC y notas; `GlobalModalProvider`, `useEntityRouteActions` con `?hub`, `ContactDrawer`, POS, `WorkOrderWizard`, `TaskInbox`, `DeclarationWizard`, `UnbilledCharges`, entre otros).
- El POS **incrusta** `OrderHubPanel` en `pos/SalesOrdersDrawer`.
- `getHubStatuses` se usa en las celdas de lista (`DomainHubStatus` en `salesOrderFields`, `ContactDrawer` y `PurchasingOrdersClientView`).

### 1.2 Las fichas actuales

- **No hay una estructura común.** `SaleOrderDrawer`, `InvoiceDrawer`, `PurchaseOrderDrawer`, `StockMoveDrawer` y los demás repiten a mano el mismo patrón: `Drawer` + `FormSplitLayout` + rejilla `grid-cols-2` con `<span>`/`<p>` + lista de líneas con `<div>`.
  - No usan `FormSection` ni `DataCell`/`*Fields`.
  - `InvoiceDrawer` hace `as unknown as Record<string, unknown>` para leer el folio y el vencimiento, porque el tipo está incompleto.
- `DocumentDrawerShell` (M3) solo tiene las zonas `summary`/`children`/`related`. No tiene tabs, barra de acciones, progreso ni sidebar de actividad. La usan solo `SaleDeliveryDrawer` y `PurchaseReceiptDrawer`.
- **Referencia buena:** `ContactDrawer` (ficha maestra) = `Drawer` → `FormSplitLayout` (con `ActivitySidebar`) → `TabBar` horizontal `underline` → `TabBarContent`. Es el patrón a generalizar.

### 1.3 Desfases de contrato (se corrigen en U0)

| Contrato | Problema |
|---|---|
| `component-form-patterns.md` §3/§6 | Documenta `FormTabs`/`FormTabsContent`, que **ya no existen**. La primitiva real es `TabBar`/`TabBarContent` (`orientation`, `variant: toolbar\|folder\|underline`). |
| `component-form-patterns.md` §3 | La regla "≥5 tabs ⇒ vertical" está pensada para formularios modales. Los drawers maestros (`ContactDrawer`, `ProductDrawer`) usan horizontal `underline`. Falta la fila "ficha maestra/documental en Drawer". |
| `component-entity-drawers.md` / `document-relations.md` / ADR-0080 | Fijan D4 ("la ficha de OV/OC es el Hub"). La nueva etapa lo **revierte** y hace falta un ADR. |
| `HubConfig.type: 'obligation'` | No existe en el backend. Es un tipo muerto. |

---

## 2. Arquitectura propuesta

### 2.1 Anatomía de la ficha documental

Una sola estructura para todos los documentos (`DocumentDrawerShell` evolucionado). Usa el `Drawer` izquierdo de ancho `master`:

```
┌─ PanelHeader ───────────────────────────────────────────────────────────┐
│ ← Volver a FACT-1021   [icono] NV-000123  ·  Imprenta Sur  · 12-10-2026 │
│ [StatusBadge Confirmada]                          [Imprimir] [⋯ Más]   │
├─ Ciclo (solo documentos con ciclo) ─────────────────────────────────────┤
│  Origen ●──── Facturación ◐──── Producción ○──── Logística ◐──── Pago ○ │
│  Total 1.250.000   Facturado 60%   Entregado 40%   Saldo 1.250.000 (mono)│
├─ Barra de acciones ─────────────────────────────────────────────────────┤
│  [■ Registrar despacho]  Facturar por entregas · Registrar pago · Más ▾ │
├─ TabBar underline ──────────────────────────────────────┬───────────────┤
│  RESUMEN · LÍNEAS · RELACIONES (12) · …                 │ Activity      │
│                                                         │ Sidebar       │
│  (contenido del tab: FormSection × N)                   │ (auditoría)   │
└─────────────────────────────────────────────────────────┴───────────────┘
```

Zonas:

| Zona | Qué hace | Primitiva |
|---|---|---|
| **Encabezado** | Identidad, estado, "Volver a…" (pila de `openEntity`) e impresión. Las acciones destructivas van en "Más". | `Drawer`/`PanelHeader` + `useDrawerIdentity` + `StatusBadge` |
| **Ciclo** (opcional) | Reemplaza `HubStatus` y `OrderHeaderDashboard`. Muestra cinco pasos con su estado y 3–4 cifras clave en JetBrains Mono, sin tarjetas. Al pulsar un paso se abre Relaciones filtrado por ese dominio. | Nuevo `DocumentLifecycle` (shared, presentacional) |
| **Barra de acciones** | Reemplaza `PhaseCard`, `ActionCategory` y el motor headless. Lleva **1 acción primaria** (el siguiente paso del ciclo), hasta 3 secundarias y un menú "Más" con el resto. | Nuevo `DocumentActionBar` + hook `useDocumentActions` |
| **Tabs** | Resumen · Líneas · Relaciones, más los tabs propios del tipo. | `TabBar` horizontal `underline` (precedente: `ContactDrawer`) |
| **Sidebar** | Historial de cambios. | `FormSplitLayout` + `ActivitySidebar` |

### 2.2 Tabs estándar y orden de la información

Cada tab sigue las capas de `form-layout-architecture.md` §3. Cada capa es un `FormSection` con campos de solo lectura (`DataCell`/`LabeledContainer` en modo vista):

| Tab | Contenido |
|---|---|
| **Resumen** | **1 · Contexto:** contraparte, fechas, folio y referencias, documento origen. **2 · Condiciones:** plazo y forma de pago, bodega, canal, moneda. **3 · Totales:** neto, impuestos, total, facturado, pagado y saldo. **4 · Ciclo de vida:** creado/confirmado por, notas internas, adjuntos. |
| **Líneas** | `DataTable` con `*LineFields.toColumns()` (invariante 13). Incluye columnas de avance `quantity_delivered` y `quantity_invoiced` con una barra de cumplimiento (datos de M4). Las notas muestran la línea corregida (GAP-14). |
| **Relaciones** | Tab reutilizable (§2.3). Badge con el número de documentos relacionados. |
| *Propios del tipo* | Asiento: Partidas. Pago: Imputaciones. Inventario: Movimientos. OT: Etapas. Solo cuando aportan algo que Relaciones no cubre. |

Los tabs vacíos se ocultan (`TabItem.hidden`). El máximo es de 5 tabs visibles en horizontal; si un tipo necesita más, se pasa a vertical según el contrato.

### 2.3 Tab "Relaciones" reutilizable (`DocumentRelationsTab`)

Va en `features/documents` y lo exporta su barrel. Su API es `label`, `id` y `sectionActions?`. Consume `useDocumentRelations` (M2) y reutiliza `RelatedDocumentsTable` (M3).

- **Agrupa por dominio operativo**, en el mismo orden que el ciclo:
  - Origen (derivación hacia arriba);
  - Facturación (facturas, notas);
  - Producción (OT);
  - Logística (despachos, recepciones, devoluciones, documentos de inventario, movimientos de stock);
  - Tesorería (pagos, imputaciones, cheques, lotes);
  - Contabilidad (asientos);
  - Otros.
- Cada grupo es un `SectionHeader` (variante `list`) con: número de documentos, suma de `amount` y un **slot de acciones de sección**. Por ejemplo, "+ Registrar pago" en Tesorería y "+ Despacho" en Logística. Con esto el tab absorbe las 5 phases del Hub, `DocumentListModal` y `PaymentHistoryModal`.
- Columnas:
  - documento (`display_id`, que abre la ficha con `openEntity`, apilada);
  - relación (`semantic` con `Chip`);
  - fecha;
  - `StatusBadge`;
  - importe y cantidad en mono.
- Las `unresolved` (referencias colgantes) se listan con aviso y `accessible=false`, sin contenido.
- Estados:
  - **cargando:** skeleton con la forma de los grupos;
  - **vacío por grupo:** `EmptyState` compacto con la acción de la sección ("Sin pagos · Registrar pago");
  - **error:** inline en el tab, sin romper la ficha.
- El dominio sale del backend: el campo **`domain`** se añade a `DocumentTypeRegistry` y se expone en `DocumentRef`. Es un cambio aditivo del contrato `document-relations.md`. Así el frontend no mantiene otro mapa de tipos (ADR-0080 evitó un 8.º registro).

### 2.4 Acciones dentro de la ficha (sin motor global)

- `useDocumentActions(label, doc, context?)`:
  - toma el registro de acciones del tipo (`DOCUMENT_ACTIONS[label]`, que agrupa `saleOrderActions`, `purchaseOrderActions` y las de factura/nota);
  - resuelve permisos, `requiredStatus`, `checkAvailability` e `isDisabled`;
  - devuelve `{ primary, secondary, overflow, bySection, run(actionId) }`.
- `DocumentActionHost`: se monta **dentro** de la ficha. Aloja los mismos 13 modales lazy que hoy tiene `ActionCategory`, sin cambios. El flujo de anulación reutiliza `useCancelOrderFlow`.
- Desaparecen:
  - `actionEngineRef`/`triggerAction` (un `ref` global con `console.warn` cuando es `null`);
  - el truco `setHubTemporarilyHidden`, porque los modales se apilan sobre el drawer de forma natural.
- `context` lleva `posSessionId` (POS) y `onActionSuccess`. Tras cada acción se invalidan la ficha, `documentRelations` y las listas.
- **La acción primaria** se elige por el siguiente paso pendiente del ciclo:
  - folio por completar → facturar;
  - pendiente de entrega → despachar;
  - con saldo → registrar pago.

  Si no queda ninguno, no hay primaria (estado "completado").

### 2.5 Progreso del ciclo sin buckets legacy

- `getHubStatuses` usa `related_documents` (deprecado). Se reemplaza por **`getDocumentLifecycle(doc)`**, que se calcula con los campos de estado del propio documento ya normalizados en M1/M4:
  - `invoicing_status`;
  - `delivery_status`/`receipt_status`;
  - `pending_amount`;
  - estado de producción.

  Si falta algún dato, se añade al serializer. No se vuelve a leer de los buckets.
- `DomainHubStatus`, la celda de lista, pasa a usar este cálculo. Se renombra a `DocumentLifecycleCell`.

### 2.6 Navegación y URL

- **OV y OC:**
  - `openEntity("sales.saleorder"\|"purchasing.purchaseorder", id)` abre la ficha (deja de llamar a `openHub`);
  - `?selected={id}` sigue siendo el deep link;
  - `?hub` se elimina.
- **Facturas:** `openHub({invoiceId})` se reemplaza por `openEntity("billing.invoice", id)`. El "modo nota" pasa a ser simplemente la ficha de la NC/ND, con su ciclo reducido.
- **POS:** `SalesOrdersDrawer` deja de incrustar `OrderHubPanel`. Abre la ficha con `openEntity(..., { context: { posSessionId } })`, apilada sobre el drawer del POS.
- **Deep link de tab (opcional):** `?selected=id&tab=relaciones`.

### 2.7 Nuevas piezas y lugar en FSD

| Pieza | Capa | Notas |
|---|---|---|
| `DocumentDrawerShell` (evolución) | `components/shared` | Slots: `lifecycle`, `actionBar`, `tabs: {value,label,icon,badge,hidden,content}[]`, `sidebar`. Mantiene `loading`/`error`. |
| `DocumentLifecycle` | `components/shared` | Presentacional: pasos + cifras. Los colores salen de los tokens de estado; el ciclo CMYK queda reservado a la navegación (ADR-0076). |
| `DocumentActionBar` | `components/shared` | Presentacional. Recibe `Action[]` ya resueltas y usa `NotchedButton`/`ActionButtons`. |
| `DocumentRelationsTab` | `features/documents` | Agrupación, acciones por sección y estados. |
| `useDocumentActions`, `DocumentActionHost`, `DOCUMENT_ACTIONS`, `getDocumentLifecycle` | `features/documents` | `ActionCategory` y `actions.tsx` se mueven aquí desde `features/orders` (sin cambios de lógica). |
| Fichas por tipo | cada feature | `SaleOrderDrawer`, `PurchaseOrderDrawer`, `InvoiceDrawer` y demás se reescriben sobre el shell. Se quita la marca `@deprecated` de las de OV/OC. |

---

## 3. Plan por fases

Cada fase cierra con:
- `npm run type-check` + `npm run lint`;
- vitest remoto del ámbito tocado;
- pytest si cambia el backend;
- una prueba de humo en el navegador.

| Fase | Alcance | Resultado |
|---|---|---|
| **U0 · Contratos** | **ADR-0083** "Ficha documental reemplaza el Order Hub" (revierte D4 de ADR-0080). Nuevo contrato `docs/20-contracts/component-document-sheet.md` (anatomía, tabs estándar, acciones, estados). Actualizaciones: `component-entity-drawers.md`, `document-relations.md` (`domain`, retiro de D4) y `component-form-patterns.md` (de `FormTabs` a `TabBar`, fila de ficha maestra/documental). Se registra D4' en `document-decisions.md`. | Contratos coherentes antes del código. |
| **U1 · Primitivas** | Backend: `domain` en el registro y en `DocumentRef` (+ tests de contrato). Frontend: shell evolucionado, `DocumentLifecycle`, `DocumentActionBar`, `DocumentRelationsTab`, `useDocumentActions` + `DocumentActionHost`, `getDocumentLifecycle`. Tests vitest de agrupación, selección de la acción primaria y estados. | Piezas listas, sin consumidores nuevos. |
| **U2 · Piloto OV** | `SaleOrderDrawer` sobre el shell. `openEntity("sales.saleorder")` abre la ficha. **Checklist de paridad:** las 16 acciones únicas de la OV (15 del registro + anular) y las 5 phases, comprobadas una por una. El Hub sigue disponible para OC y facturas. | Una ficha completa y validada. |
| **U3 · OC + facturas/notas** | `PurchaseOrderDrawer` e `InvoiceDrawer` (con la acción de nota absorbida). Se tipa el `Invoice` completo (fuera los casts a `Record`). | Las 3 superficies del Hub cubiertas. |
| **U4 · Puntos de entrada** | Los 23 `openHub` pasan a `openEntity`. Además: el POS, `TaskInbox` (se elimina `'obligation'`), `DeclarationWizard`, `ContactDrawer`, `WorkOrderWizard` y su test, y `?hub` en `useEntityRouteActions`. `DomainHubStatus` pasa a `DocumentLifecycleCell`. | Nadie usa ya el Hub. |
| **U5 · Resto de fichas** | Reordenamiento por capas de: despachos, recepciones, documento y movimiento de inventario, movimiento de tesorería/pago, asiento, OT, devoluciones, cheque, lote de terminal, liquidación de sueldo y distribución de utilidades. | Todas las fichas con la misma anatomía. |
| **U6 · Retiro** | Se eliminan `features/orders/components/*`, `GlobalHubPanel`, `HubPanelProvider`, la pestaña global "HUB" del shell y `useOrderHubData`. En el backend se eliminan los buckets `related_documents` de OV/OC/factura y `JournalEntry.source_documents` (cierra M6/ADR-0080 §7). Se actualizan los docs y el progreso. | Unas 4.600 líneas menos en el frontend y los formatos legacy fuera. |

Estimación: U0–U1 ≈ 1 bloque · U2 ≈ 1 · U3–U4 ≈ 1 · U5 ≈ 1–2 · U6 ≈ 0,5.

---

## 4. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Que una acción del Hub quede sin equivalente | Checklist de paridad en U2/U3 generado desde `DOCUMENT_ACTIONS` (test que exige que cada id tenga host de modal). |
| Que el ancho del drawer no alcance para la barra de acciones y los tabs | Máximo 4 botones visibles; el resto va en "Más". El sidebar de actividad es colapsable. |
| Que el POS dependa del panel incrustado y de `posSessionId` | `context` explícito en `openEntity`; prueba manual del flujo de cobro en POS. |
| Que las celdas de lista cambien de cálculo | `getDocumentLifecycle` con tests contra los mismos casos que `getHubStatuses`, antes de cambiarlo. |
| No hay pruebas en el navegador automatizadas | Prueba de humo manual o con Claude-in-Chrome en el dev server en cada fase (requiere credenciales). |
| Que la pila de `openEntity` (máx. 5) se sature al navegar por relaciones | Ya existe un recorte FIFO; se muestra "Volver a…". |

## 5. Decisiones (resueltas 2026-10-15)

Registradas como D7–D11 en [document-decisions.md](./document-decisions.md): piloto en OV · tabs horizontales · un único tab Relaciones agrupado por área · franja de ciclo conservada · POS con vista incrustada.

## 6. Ajustes al implementar U1–U2

- El motor de acciones de documentos comerciales (`useOrderActionEngine`), las acciones por documento relacionado (`useOrderRelatedActions`), el ciclo (`getOrderLifecycle`) y la ficha `OrderSheet` viven en `features/orders` (no en `features/documents`): dependen de ventas, compras, tesorería, notas y producción. Lo genérico (`DocumentRelationsTab`, `resolveRegistryActions`, áreas) sí está en `features/documents`. En U6 `features/orders` queda reducido a la ficha de órdenes y su motor.
- `ActionCategory` del Hub delega en `useOrderActionEngine` y `TreasuryPhase` usa `AnnulPaymentModal`: durante la convivencia no hay lógica duplicada.
- `SaleOrderDrawer` se eliminó (0 consumidores tras U2; la vista previa de `AdvancedSaleOrderSelector` abre la ficha con `openEntity`).
