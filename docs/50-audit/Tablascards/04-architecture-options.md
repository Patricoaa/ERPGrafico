# 04 · Arquitectura objetivo: alternativas y decisión (Fase 4)

> Fecha: 2026-10-17 · Sin cambios de código de producción. Rutas relativas a `frontend/`.
> Entradas aprobadas en la Puerta A: causas RC1–RC8 (`01`), matriz común/frecuente/específico y requisitos ED (`02`), restricciones AX/PF/TY (`03`), pantallas UoM, OV y Compras, `role="table"` en `compact` y **exportación como requisito**.
> Diagrama de la alternativa recomendada: [`diagrams/alt-c-hybrid.html`](diagrams/alt-c-hybrid.html) (fuente: `diagrams/alt-c-hybrid.architecture.json`).
> Borrador de ADR: [`docs/10-architecture/adr/0087-entity-view-system.md`](../../10-architecture/adr/0087-entity-view-system.md) (*Proposed*).

---

## 1. Principios (hipótesis del prompt contrastadas con la evidencia)

| # | Principio | Veredicto | Evidencia |
|---|---|---|---|
| P1 | **Capas separadas:** semántica del campo → formato puro → renderer → layout de superficie | **Confirmado** | RC8: formato en línea en ≥10 sitios; RC3: layout acoplado; `03` §4 (todas las referencias separan formato y vista) |
| P2 | **Abierto a extensión, cerrado a modificación** (registro tipado, sin `computed` opaco) | **Confirmado, con un dato nuevo**: FSD **obliga** a la extensión. `DocumentRefLink` vive en `features/documents` y shared no puede importarlo, así que el tipo de valor más demandado (referencia, 40 % de los `computed`) **solo** puede existir como extensión registrada por una feature | `features/documents` exporta `DocumentRefLink` (14 importadores); invariante #3 |
| P3 | **Composición antes que configuración** | **Confirmado** | RC6: 21 de 67 props con 0–1 consumidores; `EntityCard` compound (F8) |
| P4 | **Defaults sin configuración; escapes locales y tipados** | **Confirmado** | Clase C de la matriz (`02` §5.5); 29 `renderCard` pass-through |
| P5 | **La semántica se comparte entre superficies; el layout no** | **Confirmado** | RC2/RC3: 43 `placement: 'detail'`; F9 (lo legítimo de ADR-0057/0059 es compartir *importancia*, no posición) |
| P6 | **Una sola fuente de verdad por entidad** | **Confirmado con matiz**: la *identidad* (etiqueta, icono, URL, drawer) sigue en `entity-registry` y en el registro de drawers, porque la usan búsqueda global, navegación y documentos. La *presentación* (`viewPolicy`, `cardConfig`, `workflow`, `partnerField`) migra a la definición de entidad | RC7; `entity-registry.ts` tiene 1387 líneas y otros consumidores (búsqueda, drawers, `DocumentRef.label`) |
| P7 (nuevo) | **Accesible por construcción**: una sola `<table>`, la acción por defecto como enlace real, sin interactivos anidados | Nuevo, desde `03` | AX-1 … AX-4 |
| P8 (nuevo) | **Las colecciones editables son una superficie, no un formulario aparte** | Nuevo, desde `02` §4 | 11 tablas P1/P2 con el mismo contrato; ED-1 … ED-9 |
| P9 (nuevo) | **Adopción gradual sin tocar el sistema antiguo** (strangler, no fachada) | Nuevo | 202 consumidores de la familia; ADR-0078 |

---

## 2. Alternativas

Las tres comparten la ubicación del spike (`components/entity-view/`, barrel propio; §7), el uso de TanStack Table como motor y la herencia visual (tokens `--table-*`, `DataCell`/`StatusBadge` como primitivas de render). Se diferencian en **dónde vive la semántica** y **cómo se compone la superficie**.

### 2.A · Esquema declarativo abierto (todo configuración)

**Idea:** evolucionar `createEntityFields` a un **esquema único por entidad** que describe campos, superficies, toolbar, acciones, modos, exportación y edición. Un único componente genérico `<EntityCollection definition={…} />` lo interpreta. La extensibilidad se logra con registros abiertos (tipos de valor, secciones de card).

```
features/<entidad>/<entidad>.view.ts ──► <EntityCollection definition> ──► (interpreta todo)
        campos + superficies + toolbar + modos + export + edición
```

```ts
// features/inventory/uom.view.ts — trivial
export const uomView = defineEntityView<UoM>()({
  label: 'inventory.uom',
  fields: {
    name:         { kind: 'text',   from: 'name',          label: 'Nombre' },
    abbreviation: { kind: 'code',   from: 'abbreviation',  label: 'Abreviación' },
    category:     { kind: 'text',   from: 'category_name', label: 'Categoría', tone: 'secondary' },
    type:         { kind: 'status', from: (u) => UOM_TYPE[u.uom_type], label: 'Tipo' },
    ratio:        { kind: 'number', from: 'ratio',         label: 'Ratio' },
  },
  table: { columns: ['name', 'abbreviation', 'category', 'type', 'ratio'] },
  card:  { title: 'name', subtitle: ['abbreviation', 'category'], trailing: ['type'] },
  toolbar: { search: uomSearchDef, create: 'drawer' },
  selection: { bulk: uomBulkActions },
})
// página
export const UoMClientView = () => <EntityCollection definition={uomView} query={useUoMs} />
```

```ts
// features/sales/saleOrder.view.ts — documental
export const saleOrderView = defineEntityView<SaleOrder>()({
  label: 'sales.saleorder',
  fields: {
    folio:    { kind: 'code',      from: (o) => o.display_id ?? o.number, label: 'Folio' },
    customer: { kind: 'contact',   from: (o) => ({ id: o.customer, name: o.customer_name }), label: 'Cliente' },
    date:     { kind: 'date',      from: 'date', label: 'Fecha' },
    stage:    { kind: 'status',    from: orderStageSummary, label: 'Estado' },
    hub:      { kind: 'hubStatus', from: (o) => o, entity: 'sales.saleorder', label: 'Flujo' },
    total:    { kind: 'money',     from: 'total', label: 'Total' },
    pending:  { kind: 'money',     from: 'pending_amount', label: 'Pendiente' },
    delivery: { kind: 'date',      from: 'delivery_date', label: 'Entrega' },
    lines:    { kind: 'count',     from: (o) => o.lines.length, label: 'Líneas' },
  },
  table: { columns: ['folio', 'customer', 'date', 'stage', 'total', 'pending'], defaultSort: ['-date'] },
  card:  { title: 'folio', subtitle: ['customer', 'date'], trailing: ['hub'],
           body: { section: 'workflow', lines: 'lines', total: 'total', pending: 'pending', date: 'delivery' } },
  selection: { mode: 'panel', open: 'documentSheet' },
  analytics: saleOrderAnalytics,
  export: { hook: useExportSaleOrders, formats: ['xlsx', 'csv'] },
})
```

```ts
// Compras — la más rígida: modos dentro del esquema
export const purchasingView = defineModedView({
  param: 'view_mode',
  modes: {
    orders: { view: purchaseOrderView,   query: usePurchaseOrders },
    notes:  { view: purchaseInvoiceView, query: usePurchaseNotes },
  },
})
export const PurchasingOrdersClientView = () => <EntityCollection definition={purchasingView} />
```

| Causa | Cómo la resuelve A |
|---|---|
| RC1 | Registro abierto de `kind` (aumentación de módulos) |
| RC2/RC3 | Layout explícito por superficie (`table.columns`, `card.*`); sin inferencia |
| RC4 | `card.icon`, `card.media` y acciones en el esquema → sin `renderCard` |
| RC5 | Selección, acciones, facetas y modos dentro del esquema |
| RC6 | **Solo traslada el problema**: el monolito de props pasa a ser un monolito de claves de configuración en `<EntityCollection>` |
| RC7 | `viewPolicy`/`cardConfig` migran al esquema |
| RC8 | Ids literales, accesores tipados, formatters puros |

- **Coste de migración:** medio. Un adaptador `fromLegacyFields()` cubre los ~30 `*Fields` sin `computed`.
- **Riesgo principal:** reaparece el **antiobjetivo 1** (mega-componente configurable). Cada caso nuevo de toolbar, paginación o layout agrega una clave. Lo específico (conciliación, kanban de OT, wizard) no cabe y vuelve a escaparse.
- **Curva para un agente:** muy baja. Un archivo de configuración y una página de 1 línea.

### 2.B · Composición headless (todo composición)

**Idea:** shared aporta solo **primitivas**: estado de colección (`useCollectionState`: TanStack + URL), tabla accesible (`<DataGrid.Table/Row/Cell>`), celdas (`Cell.Money`, `Cell.Date`…), formatters y la card compound. **Cada entidad escribe su propia tabla y su propia card en JSX.** No hay esquema compartido entre superficies.

```
features/<entidad>/UoMTable.tsx + UoMCard.tsx + UoMClientView.tsx ──► primitivas de components/shared
```

```tsx
// features/inventory/components/UoMTable.tsx — trivial
export function UoMTable({ state }: { state: CollectionState<UoM> }) {
  return (
    <DataGrid.Table state={state} label="Unidades de medida">
      <DataGrid.Column id="name" header="Nombre" sort cell={(u) => <Cell.Text value={u.name} />} />
      <DataGrid.Column id="abbreviation" header="Abreviación" cell={(u) => <Cell.Code value={u.abbreviation} />} />
      <DataGrid.Column id="category" header="Categoría" cell={(u) => <Cell.Secondary value={u.category_name} />} />
      <DataGrid.Column id="type" header="Tipo" cell={(u) => <Cell.Status {...UOM_TYPE[u.uom_type]} />} />
      <DataGrid.Column id="ratio" header="Ratio" align="end" cell={(u) => <Cell.Number value={u.ratio} />} />
    </DataGrid.Table>
  )
}
// UoMCard.tsx repite name/abbreviation/category/type con otro layout
```

```tsx
// OV — documental: columnas y card escritas a mano; la referencia usa DocumentRefLink directamente
<DataGrid.Column id="total" header="Total" align="end" cell={(o) => <Cell.Money value={o.total} />} />
<SaleOrderCard order={o} />  // EntityCard.Header/Body con WorkflowBody, hub, icono
```

```tsx
// Compras — modos: dos árboles JSX con un conmutador en la página
{mode === 'orders' ? <PurchaseOrderTable state={ordersState} /> : <PurchaseNoteTable state={notesState} />}
```

| Causa | Cómo la resuelve B |
|---|---|
| RC1 | No hay tipos que cerrar: cada celda es JSX sobre primitivas |
| RC2/RC3 | Layout totalmente manual por superficie |
| RC4 | Card escrita por entidad |
| RC5 | La colección es composición |
| RC6 | Núcleos pequeños |
| RC7 | Presentación en la feature |
| RC8 | **Empeora la coherencia**: el mismo campo se escribe 2–3 veces (tabla, card, export); la coherencia de formato depende de la disciplina |

- **Coste de migración:** alto. Sin adaptador posible: 65 `*Fields` se reescriben a JSX.
- **Riesgo principal:** pierde **F1** (declarar una vez, la mayor fortaleza del sistema actual) y deja la clase C (común) con código a medida en cada entidad, contra el objetivo "cero código para lo común".
- **Curva para un agente:** media. 3 archivos y mucho JSX repetido; fácil de copiar mal.

### 2.C · Híbrido: esquema semántico + composición por superficie (**recomendada**)

**Idea:** separar **qué es** cada campo (definición de entidad: semántica, accesor tipado, formato) de **cómo se compone** cada superficie (layouts declarados por superficie con ids literales, más compound components que la página compone). Lo común sale de la definición sin código. Lo frecuente se declara con opciones del tipo de valor o del layout. Lo específico se extiende **en la feature**: registrando un tipo de valor, una sección de card o un componente de superficie que recibe el modelo tipado.

Capas (ver diagrama):

```
features/<entidad>/                         components/entity-view/ (núcleo)
 ├─ defineEntity<T>  ── ids tipados ──►      ├─ useEntityCollection  (TanStack + URL; headless)
 ├─ views (table/card/kanban/editable) ─►    ├─ Collection.*  (Root · Toolbar · View · Table · Grid · Footer · Empty)
 └─ extensiones (registerValueKind…) ──►     ├─ registro de tipos de valor (abierto, tipado)
                                             └─ formatters puros (Intl es-CL)
hook de feature (TanStack Query → DRF) ─► filas + rowCount      exportación ─► /api/…/export/?format= (contrato backend)
```

#### Núcleo: registro abierto de tipos de valor

```ts
// components/entity-view/value-kinds.ts (núcleo)
export interface ValueKinds {
  text:      { value: string;                        options: { tone?: 'default' | 'secondary'; truncate?: boolean; icon?: LucideIcon } }
  code:      { value: string;                        options: { prefix?: string } }
  number:    { value: number | DecimalString;        options: { suffix?: string } }
  quantity:  { value: number | DecimalString;        options: { uom: string | null } }
  money:     { value: number | DecimalString;        options: { currency?: CurrencyCode; sign?: 'auto' | 'always' | 'never' } }
  flow:      { value: number | DecimalString;        options: { direction: FlowDirection; unit?: 'money' | string } }
  date:      { value: ISODate | null;                options: { time?: boolean } }
  dateRange: { value: { from: ISODate; to: ISODate | null }; options: Record<never, never> }
  status:    { value: StatusValue;                   options: Record<never, never> }   // { status, label?, intent? } → StatusBadge
  hubStatus: { value: HubStatusInput;                options: { entity: EntityLabel } } // DomainHubStatus
  contact:   { value: { id: number; name: string } | null; options: Record<never, never> }
  tags:      { value: readonly string[];             options: { domain?: CategoryDomain } }
  progress:  { value: { done: number; total: number }; options: { format?: 'percent' | 'ratio' } }
}
export type ValueKind = keyof ValueKinds

/** Contrato de un tipo: formato puro (export, subtítulo, orden) + render por superficie. */
export interface ValueKindSpec<K extends ValueKind> {
  format: (value: ValueKinds[K]['value'], options: ValueKinds[K]['options']) => string
  sortValue?: (value: ValueKinds[K]['value']) => string | number | null
  render: ComponentType<{ value: ValueKinds[K]['value']; options: ValueKinds[K]['options']; surface: Surface }>
}
export function registerValueKind<K extends ValueKind>(kind: K, spec: ValueKindSpec<K>): void
```

#### Extensión en una feature (resuelve el 40 % de los `computed` sin tocar shared)

```ts
// features/documents/entity-view.ts — registra el tipo "docRef" desde la feature dueña del componente
import { registerValueKind } from '@/components/entity-view'
import { DocumentRefCell } from './components/DocumentRefCell'   // envuelve DocumentRefLink (ADR-0086)

declare module '@/components/entity-view' {
  interface ValueKinds {
    docRef: { value: DocumentRefLike | null; options: { fallback?: string } }
  }
}
registerValueKind('docRef', {
  format: (ref, { fallback }) => ref?.display_id ?? fallback ?? '—',
  sortValue: (ref) => ref?.display_id ?? null,
  render: DocumentRefCell,
})
```

#### UoM (trivial): 2 archivos, cero código a medida

```ts
// features/inventory/uom.entity.ts
import { defineEntity, f } from '@/components/entity-view'

export const uomEntity = defineEntity<UoM>()({
  label: 'inventory.uom',
  fields: {
    name:         f.text('name', { label: 'Nombre' }),
    abbreviation: f.code('abbreviation', { label: 'Abreviación' }),
    category:     f.text('category_name', { label: 'Categoría', tone: 'secondary' }),
    type:         f.status((u) => UOM_TYPE[u.uom_type], { label: 'Tipo' }),   // accesor tipado → StatusValue
    ratio:        f.number('ratio', { label: 'Ratio' }),
  },
})

export const uomViews = uomEntity.views({
  table: { columns: ['name', 'abbreviation', 'category', 'type', 'ratio'] },   // unión literal: 'nmae' no compila
  card:  { title: 'name', subtitle: ['abbreviation', 'category'], trailing: ['type'] },
})
```

```tsx
// features/inventory/components/UoMClientView.tsx
export function UoMClientView() {
  const collection = useEntityCollection(uomEntity, useUoMs())          // hook de feature (invariante #5)
  return (
    <Collection.Root collection={collection} actions={uomActions} selection="bulk">
      <Collection.Toolbar search={uomSearchDef} create={<CreateUoMButton />} />
      <Collection.View table={uomViews.table} card={uomViews.card} />
    </Collection.Root>
  )
}
```

- La acción por defecto (abrir el drawer de `inventory.uom`) sale de la etiqueta vía el registro de drawers (ADR-0028). El título es un **enlace real** (AX-3).
- La selección masiva es una capacidad de `Collection.Root`, no una columna inline.

#### OV (documental): modos, estado hub, cuerpo de workflow y exportación sin `computed`

```ts
// features/sales/saleOrder.entity.ts
export const saleOrderEntity = defineEntity<SaleOrder>()({
  label: 'sales.saleorder',
  fields: {
    folio:    f.code((o) => o.display_id ?? o.number, { label: 'Folio' }),
    customer: f.contact((o) => ({ id: o.customer, name: o.customer_name }), { label: 'Cliente' }),
    date:     f.date('date', { label: 'Fecha' }),
    stage:    f.status(orderStageSummary, { label: 'Estado' }),                       // status derivado (antes computed F)
    hub:      f.hubStatus((o) => o, { label: 'Flujo', entity: 'sales.saleorder' }),    // antes computed G
    channel:  f.tags((o) => [o.channel], { label: 'Canal', domain: 'channel' }),
    total:    f.money('total', { label: 'Total' }),
    pending:  f.money('pending_amount', { label: 'Pendiente' }),
    delivery: f.date('delivery_date', { label: 'Entrega' }),
    lines:    f.number((o) => o.lines.length, { label: 'Líneas' }),
  },
  facets: { production: (o) => getHubStatuses(o).production, billing: (o) => getHubStatuses(o).billing },
  export: { hook: useExportSaleOrders, formats: ['xlsx', 'csv'] },                     // contrato export-formats.md
})

export const saleOrderViews = saleOrderEntity.views({
  table: { columns: ['folio', 'customer', 'date', 'channel', 'stage', 'total', 'pending'], defaultSort: '-date' },
  card: {
    title: 'folio',
    subtitle: ['customer', 'date'],
    trailing: ['hub'],
    media: { icon: 'registry', tone: (o) => (o.status === 'CANCELLED' ? 'muted' : 'default') },
    body: cardSection.workflow({ total: 'total', pending: 'pending', date: 'delivery', lines: 'lines' }),  // antes computed D
  },
})
```

```ts
// features/orders/orderLine.entity.ts — lista embebida en la ficha: orden explícito, referencias por extensión
export const orderLineEntity = defineEntity<OrderLine>()({
  label: 'sales.saleline',
  fields: {
    product:   f.docRef((l) => l.product_ref, { label: 'Producto', fallback: undefined }),
    quantity:  f.quantity('quantity', { label: 'Cantidad', uom: (l) => l.uom_name }),
    unitPrice: f.money('unit_price_net', { label: 'Precio unit. (neto)' }),
    delivered: f.progress((l) => ({ done: l.quantity_delivered, total: l.quantity }), { label: 'Entregado', format: 'ratio' }),
    workOrder: f.docRef((l) => l.work_order_ref, { label: 'OT' }),
    subtotal:  f.money('subtotal_net', { label: 'Subtotal (neto)' }),
  },
})
export const orderLineViews = orderLineEntity.views({
  table: { columns: ['product', 'quantity', 'unitPrice', 'delivered', 'workOrder', 'subtotal'], footer: { sum: ['subtotal'] } },
})
// OC: orderLineViews.table.without('workOrder') → 'work_order_summary' no compila (TC-012 imposible)
```

> Los accesores `product_ref`, `work_order_ref` y `unit_price_net` asumen nombres de campo unificados entre OV y OC: dependen de **PB-1 (Pd-backend)**. Mientras tanto, el accesor función (`(l) => l.unit_price_net ?? l.unit_cost`) sigue siendo válido y tipado.

#### Compras (la más rígida): modos tipados, facetas sin columnas ocultas, card sin wrapper

```tsx
// app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx
const purchasingModes = defineModes({
  param: 'view_mode',
  modes: {
    orders: { entity: purchaseOrderEntity,   views: purchaseOrderViews,   query: usePurchaseOrders, label: 'Órdenes' },
    notes:  { entity: purchaseInvoiceEntity, views: purchaseInvoiceViews, query: usePurchaseNotes,  label: 'Notas' },
  },
})   // unión discriminada: sin `as unknown as`, la card de notas usa SUS campos (TC-018)

export function PurchasingOrdersClientView() {
  const collection = useModedCollection(purchasingModes)
  return (
    <Collection.Root collection={collection} selection="panel" onOpen={openDocumentSheet}>
      <Collection.Toolbar search={collection.mode.searchDef} modes analytics={purchaseAnalytics} />
      <Collection.View />                {/* tabla o card según ?view=; layouts del modo activo */}
    </Collection.Root>
  )
}
```

- Las facetas de recepción, facturación y tesorería se declaran en `purchaseOrderEntity.facets`. Desaparecen las 3 columnas ocultas.
- Las columnas de notas dejan de duplicarse: se usan `purchaseInvoiceViews`.
- `bodega` se declara como un campo más.

#### Superficie editable (P1/P2) sobre react-hook-form

```ts
// features/sales/deliveryLines.editable.ts
export const deliveryLinesEditable = orderLineEntity.editable<DeliveryLineInput>()({
  rowKey: 'id',
  context: ['product', 'quantity'],                                    // columnas de solo lectura (ids literales)
  inputs: {
    toDeliver: input.quantity({
      max: (l) => l.quantity_pending, step: (l) => uomStep(l.uom_name),
      label: (l) => `Cantidad a despachar — ${l.product_name}`,        // AX-6 / ED-1
      initial: (l) => l.quantity_pending,
    }),
  },
  eligible: (l) => (l.requires_production ? { ok: false, reason: 'Requiere producción' } : { ok: true }),  // ED-3
  footer: { sum: ['toDeliver'] },                                      // ED-4
  bulk: ['fillToMax', 'clear'],                                        // ED-5
})
// En el formulario (RHF + zodResolver, invariante #9):
// <EditableCollection definition={deliveryLinesEditable} rows={order.lines} control={form.control} name="lines" />
```

| Causa | Cómo la resuelve C |
|---|---|
| RC1 | Registro abierto de tipos de valor. Las referencias se registran en `features/documents`; los visuales de dominio, en su feature |
| RC2 | Layout declarado por superficie: sin roles, regex ni capacidades. Los avisos de densidad son *lint* y no reordenan nada |
| RC3 | `table.columns` y `card.*` son independientes. Lo que se comparte es la definición del campo y su formato |
| RC4 | `card.media/title/subtitle/trailing/body` + acciones y apertura en `Collection.Root` → los 43 `renderCard` desaparecen |
| RC5 | Selección, facetas, modos, pie y exportación son capacidades de colección; los modos son uniones discriminadas |
| RC6 | Núcleo headless + compound components con pocas props cada uno. Lo raro se compone (slot o componente de superficie de la feature), no se agrega como prop |
| RC7 | `viewPolicy`/`cardConfig`/`workflow` migran a la definición de entidad. `entity-registry` conserva solo la identidad |
| RC8 | Ids y claves literales, accesores tipados contra el tipo de valor, formatters puros compartidos por tabla, card, subtítulo y exportación, y tests de tipos |

- **Coste de migración:** medio. Adaptador `fromLegacyFields()` para los ~30 `*Fields` sin `computed`. Los 51 `computed` se convierten en tipos del núcleo (`hubStatus`, `progress`, `dateRange`, `status` derivado) o en extensiones (`docRef`).
- **Riesgos:**
  - (1) que `defineEntity` acumule opciones hasta volver al "esquema universal". Mitigación: regla de gobierno, ningún tipo nuevo en el núcleo sin ≥3 entidades que lo usen (§6).
  - (2) coste de inferencia de TS (TY-7). Mitigación: inferencia local por entidad y medición en el spike.
  - (3) dos modos de escribir lo mismo (layout declarado frente a componente de superficie propio). Mitigación: el árbol de decisión del contrato.
- **Curva para un agente:** baja. Un archivo de entidad (campos + vistas) y una página de ~10 líneas. Lo específico tiene un único camino documentado: registrar un tipo o una sección en la feature.

---

## 3. Plantillas de layout de card (de las necesidades de `02`)

Las zonas son **slots declarados** que reciben ids de campo, no un layout inferido. Visualmente heredan `EntityCard` (header, body, footer, densidad) sin cambiar la estética.

| Slot | Contenido | Necesidad que cubre (`02`) | Hoy |
|---|---|---|---|
| `media` | icono del registro, icono o tono por fila, imagen, avatar | icono o color por fila (~10), media (4) | `renderCard` |
| `title` | 1 campo (enlace real a la ficha) | todas; AX-3 | auto-título por regex |
| `subtitle` | 1–3 campos, formateados con el `format` del tipo | todas | auto-subtítulo por roles (hasta 4) |
| `meta` | pares etiqueta:valor (centro del header) | detalle (antes `placement: 'detail'`) | `centerDetail` con capacidades |
| `trailing` | KPI o estado (1–3 campos) | estado, total, hub | `header` con regla 3/1 |
| `body` | **secciones registrables**: `workflow`, `progress`, `metrics`, `lines` o una sección propia de la feature | workflow (OV/OC), progreso (Jobs, cartola), métricas (banco) | `WorkflowBody` desde el registro, `children` sin uso |
| `footer` | acciones fuera del área clicable | AX-4 | acciones dentro de `role="button"` |

**Kanban** (OT): `kanban: { laneBy: 'stage', lanes: stageLanes /* icono, color, orden */, card: { … } }`. La tarjeta de kanban usa los mismos slots. Los avisos ("sin materiales") son una sección registrada en `features/production`.

> **Skill `impeccable`:** se aplicará en la Fase 5 sobre los renders reales del spike (critique + audit) para refinar los slots dentro de `DESIGN.md`. En esta fase los layouts se especifican a partir de las necesidades medidas, sin proponer cambios estéticos.

---

## 4. Matriz de decisión

Pesos acordados a partir de los objetivos del prompt (§Propósito y §6). Puntuación de 1 (peor) a 5 (mejor). Es una **valoración del autor** apoyada en las evidencias de `01`–`03`; se somete a la Puerta B.

| Criterio | Peso | A · Esquema | B · Headless | **C · Híbrido** | ADR-0078 (mejorar) |
|---|---|---|---|---|---|
| Cobertura de requisitos sin escapes (C/F/E de `02`) | 20 | 4 | 5 | **5** | 2 |
| Extensibilidad sin tocar el núcleo | 15 | 4 | 5 | **5** | 1 |
| Seguridad de tipos (TY-1…TY-6) | 15 | 4 | 3 | **5** | 2 |
| Coherencia de formato entre superficies y exportación | 10 | 5 | 2 | **5** | 2 |
| Coste de migración (5 = barato) | 10 | 3 | 2 | **3** | 5 |
| Rendimiento (PF) | 5 | 4 | 4 | **4** | 3 |
| Simplicidad de la API (alta de entidad) | 10 | 3 | 4 | **4** | 2 |
| Verificación mecánica (lint, tests de contrato y de tipos) | 10 | 5 | 2 | **4** | 3 |
| Accesibilidad por construcción (AX) | 5 | 4 | 3 | **5** | 2 |
| **Total ponderado (sobre 100)** | 100 | **80** | **71** | **91** | **46** |

Cálculo: Σ(peso × puntuación) / 5. Por ejemplo, C = (20·5 + 15·5 + 15·5 + 10·5 + 10·3 + 5·4 + 10·4 + 10·4 + 5·5) / 5 = 455 / 5 = 91.

**Por qué C sobre A:** A puntúa alto en verificación y coherencia, pero no resuelve RC6 (solo lo traslada a la configuración) y deja lo específico sin camino (conciliación, kanban, wizard). **Por qué C sobre B:** B pierde F1 y la coherencia de formato, y convierte lo común en código a medida.

---

## 5. Evaluación de ADR-0078 ("mejorar en lugar de reemplazar")

| Aspecto | ADR-0078 | Valoración |
|---|---|---|
| Alcance | Solo `DataTable` (RC6): fachada de 56 props sobre un `DataTableCore` de ≤15 props | No toca RC1–RC5, RC7 ni RC8, que son 7 de las 8 causas aprobadas |
| Supuesto bloqueante | "No hay vitest" (Node 18) | **Ya no aplica**: vitest corre en el servidor remoto (`00` §4) |
| Coexistencia | Fachada en el mismo archivo, sin migrar consumidores | La estrategia strangler (§8) consigue lo mismo **sin** reescribir el interior del componente antiguo |
| Aprovechable | (a) test de compatibilidad de props como red durante la coexistencia; (b) quitar el `MutationObserver` de `ActionDock`; (c) estados loading/empty como composición | (a) y (c) se incorporan al núcleo nuevo; (b) es independiente |

**DP:** si se elige C, ADR-0078 pasa a ***Superseded* por ADR-0087**. El test de compatibilidad de props se reutiliza para congelar la API antigua mientras dure la coexistencia.

---

## 6. Gobierno del núcleo (para no recrear la rigidez)

| Regla | Mecanismo |
|---|---|
| Un tipo de valor entra al núcleo solo si lo usan ≥3 entidades de ≥2 features; si no, es extensión de la feature | Revisión de ADR + test de contrato que lista los tipos del núcleo |
| Ningún componente del núcleo supera N props (propuesta: 12) | Test de contrato sobre las interfaces de props (recupera la idea de ADR-0078) |
| Prohibido formatear dinero, fechas o cantidades fuera de los formatters | Regla ESLint (Fase 6) |
| Prohibido `<table>` ad hoc en features | Regla ESLint (Fase 6) |
| El código migrado no importa el sistema antiguo | Regla ESLint (Fase 7) |
| Configuraciones inválidas detectadas en compilación | Tests de tipos (`expectTypeOf`, `@ts-expect-error`) en vitest (TY-6) |

## 7. Ubicación y nombres

- **Spike (Fase 5):** `frontend/components/entity-view/` con **barrel propio** (`@/components/entity-view`), en la rama `spike/entity-view-system`. Aislado para poder borrarlo sin dejar rastro.
- **Definitivo (Fase 6, DP):** mantener `@/components/entity-view` como barrel **propio** exige ampliar la invariante #6 ("shared solo por su barrel") a "shared **o** entity-view por su barrel". La alternativa es re-exportarlo desde `@/components/shared`. Se decide en la Puerta C con el spike a la vista.
- **Nombres (invariante #11):** `Collection.*` (superficies), `EditableCollection` (superficie editable), `defineEntity`, `registerValueKind`, `cardSection.*`. Ninguno usa sufijos prohibidos.

## 8. Coexistencia y migración (anticipo de la Fase 7)

- El sistema antiguo (`DataTable`, `createEntityFields`, `AutoEntityCard`) **no se modifica** durante la coexistencia. Su API se congela con el test de compatibilidad.
- Adaptador `fromLegacyFields(legacy)` → `defineEntity` para los `*Fields` sin `computed` (V: 30 archivos, `00-consumer-inventory.md` §`*Fields`).
- Orden: primero las entidades con más escapes (Compras, OV, Productos, Socios), en lotes de ≤5 agrupados por causa raíz; después, las simples con el adaptador.
- Retirada del sistema antiguo cuando no queden consumidores (precedente ADR-0072), adaptando `semantic-ink.test.ts`.

## 9. Exportación (requisito aprobado)

- La definición de entidad declara `export: { hook, formats }`. `Collection.Toolbar` muestra la acción y pasa los **filtros actuales** (estado de URL) al hook.
- Respeta `export-formats.md`: **un hook por exportación en su feature, sin un `useExport` genérico**, y el archivo lo genera el backend (`/api/{module}/{entity}/export/?format=`) con el mismo filterset de la lista.
- El orden y la selección de columnas exportadas los decide el servicio backend. **DP:** enviar opcionalmente los ids de columnas visibles para que coincidan con la tabla (requiere ampliar el contrato; ADR).
- **Pd-backend:** no existe ningún endpoint de exportación de listas ni el pipeline asíncrono (`ExportJob`). Con los volúmenes medidos (~1 800 OV al año ≈ 2 MB en xlsx), el modo síncrono basta para las listas operativas.

## 10. Preguntas para la Puerta B

1. ¿Eliges la alternativa **C (híbrido)**, o prefieres A o B?
2. ¿Aceptas la **regla de gobierno** "un tipo de valor entra al núcleo solo con ≥3 entidades de ≥2 features" y el límite de **12 props** por componente del núcleo?
3. Objetivo de la métrica "% de entidades **sin código a medida**" (§6 del prompt). Propuesta: **≥ 85 %** de las 82 colecciones del catálogo (todo salvo lo marcado como específico en `02` §5).
4. ¿ADR-0078 pasa a *Superseded* por ADR-0087 si se acepta C?
5. ¿Aceptas que la **identidad** (etiqueta, icono, URL, drawer) siga en `entity-registry` y solo la **presentación** migre a la definición de entidad (P6)?

## 11. Verificación

| Afirmación | Cómo |
|---|---|
| `DocumentRefLink` vive en `features/documents` | `grep -rhoE "import \{[^}]*DocumentRefLink[^}]*\} from …" features app` → todos los imports desde `@/features/documents` |
| `DocumentRef` (forma) | `docs/20-contracts/document-relations.md` §1; `features/documents/types.ts:30` |
| Reglas de exportación | `docs/20-contracts/export-formats.md` §Frontend y §Estado de implementación |
| ADR-0078 | Lectura completa; supuesto de vitest contrastado con `00` §4 |
| Diagrama | `archify validate … --quality showcase` → 9/9 comprobaciones; `deliver` ok (SHA-256 del HTML en el receipt); `visual-check` → pass en 1440×900, 1600×1000, 1920×1080 y 2048×1320, sin desborde. **Sin revisión perceptiva humana.** |
| Código de ejemplo | Ilustrativo, **no compilado**: el spike de la Fase 5 lo valida |
