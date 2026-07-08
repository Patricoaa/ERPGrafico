---
layer: 20-contracts
doc: component-entity-drawers
status: active
owner: frontend-team
last_review: 2026-05-28
stability: contract-changes-require-ADR
preconditions:
  - component-drawer.md
  - entity-identity.md
  - list-modal-edit-pattern.md
related_adrs:
  - ADR-0028 (entity-drawer registry — this contract)
  - ADR-0027 (BaseDrawer for CRUD forms)
  - ADR-0020 (URL-state edit pattern)
---

# Contract: Entity Drawer Registry & Global Opener

> **Origen:** [ADR-0028](../10-architecture/adr/0028-entity-drawer-registry.md). Reemplaza a `TransactionViewModal`.

Define cómo abrir el drawer de cualquier entidad **desde cualquier componente** (badges, links de
documento origen, acciones de fila) sin tocar la URL ni reimplementar modales locales. Tres piezas:

1. **`DrawerMode`** — los 3 modos de un drawer de entidad (`create | edit | view`).
2. **`ENTITY_DRAWERS`** — registro `label → drawer`, con opener imperativo `openEntity`.
3. **`SourceDocumentLink`** — drill-down a documentos origen con fallback.

---

## 1. `DrawerMode` — modo dual/triple

**Archivo:** `frontend/features/_shared/drawer/types.ts`

```ts
export type DrawerMode = 'create' | 'edit' | 'view'

export interface DrawerBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: DrawerMode
  onSuccess?: () => void
}
```

| Modo | Cuándo | Comportamiento |
|------|--------|----------------|
| `create` | sin `initialData`/`id` | formulario vacío, footer "Crear {Entidad}" |
| `edit` | con `initialData`/`id` | pre-fill, dirty tracking, footer "Guardar Cambios" |
| `view` | lectura | campos read-only, sin footer de edición; reemplaza el rol del difunto `TransactionViewModal` |

- Un drawer **deriva** el modo por defecto: `modeProp ?? (initialData ? 'edit' : 'create')`.
- Un drawer de entidad es un componente con sufijo `Drawer` (ver [naming-conventions.md](../90-governance/naming-conventions.md)) que monta su propia `<Drawer>` ([component-drawer.md](./component-drawer.md)).

---

## 2. Registro `ENTITY_DRAWERS` + opener imperativo

### 2.1 El registro

**Archivo:** `frontend/lib/entity-drawers.tsx`

```ts
/** Props que el opener global pasa a TODO drawer de entidad. */
export interface EntityDrawerProps {
  id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  data?: unknown            // datos pre-fetcheados opcionales — evita el round-trip
  onSuccess?: () => void
  segmenter?: React.ReactNode  // segmentador opcional renderizado al pie del drawer
}

export const ENTITY_DRAWERS: Record<string, (props: EntityDrawerProps) => ReactNode>
export function hasEntityDrawer(label: string | undefined | null): boolean
```

Cada entrada es un **adaptador** que: (a) carga el componente con `next/dynamic` (code-splitting +
skeleton), y (b) mapea las props genéricas a la forma específica del drawer.

```tsx
// frontend/lib/entity-drawers.tsx
const SaleOrderDrawer = dynamic(() => import("@/features/sales").then(m => m.SaleOrderDrawer), {
  ssr: false, loading: () => skeleton("nota de venta"),
})

export const ENTITY_DRAWERS = {
  "sales.saleorder": ({ id, open, onOpenChange }) => (
    <SaleOrderDrawer id={id} open={open} onOpenChange={onOpenChange} />
  ),
  "contacts.contact": ({ id, data, open, onOpenChange, onSuccess }) => (
    <ContactDrawer contact={data ?? { id }} open={open} onOpenChange={onOpenChange} onSuccess={onSuccess} />
  ),
  // … 34 entidades registradas
}
```

> El `label` es la clave Django `app.model` — la **misma** que usa `ENTITY_REGISTRY`
> ([entity-identity.md](./entity-identity.md)). Mantenelas alineadas.

> **Prop canónico `id`:** los transaction drawers extienden `TransactionDrawerProps` (`id: number | null`
> requerido) y resuelven `id ?? <specificId>` internamente. En el adaptador pasá **`id={id}`** — no el
> alias específico (`orderId`/`invoiceId`/…), que solo existe por compatibilidad y deja el `id`
> requerido sin setear.

### 2.2 Opener — `GlobalModalProvider`

**Archivo:** `frontend/components/providers/GlobalModalProvider.tsx` (montado una sola vez en el layout autenticado)

```ts
const { openEntity, closeEntity, hasEntityDrawer } = useGlobalModals()

openEntity('sales.saleorder', 123)            // abre el drawer registrado (modo derivado)
openEntity('contacts.contact', 7, contactObj) // con datos pre-fetcheados
closeEntity()
```

| API | Tipo | Notas |
|-----|------|-------|
| `openEntity` | `(label: string, id: number, data?: unknown, segmenter?: React.ReactNode) => void` | Advierte en consola (no rompe) si no hay drawer registrado para el label |
| `closeEntity` | `() => void` | |
| `useGlobalModals()` | hook | Acciones + estado de stacking de sheets (offsets de `CollapsibleSheet`) |
| `useGlobalModalActions()` | hook | Solo acciones (sin re-render por estado de sheets) |

**Openers deprecados** (delegan en `openEntity`, no usar en código nuevo):
`openWorkOrder(id)`, `openContact(id, data?)`, `openTreasuryAccount(id)`.

### 2.3 `segmenter` — segmentador de datos opcional

El prop `segmenter` permite inyectar un **segmentador de datos** (filtros de rango, categoría, etc.)
al pie del drawer, útil cuando el drawer contiene visualizaciones (gráficos, tablas resumen).

**Flujo de datos:**

```
EntityBadge segmenter={...}
  → openEntity(label, id, data, segmenter)
    → GlobalModalProvider.renderEntityDrawer()
      → EntityDrawerProps.segmenter
        → DrawerComponent (lo renderiza al fondo si existe)
```

- `EntityBadge` acepta `segmenter?: React.ReactNode` y lo pasa a `openEntity`.
- `EntityDrawerProps` incluye `segmenter?: React.ReactNode`.
- Cada drawer **decide** si renderiza el segmenter (típicamente envuelto en `<div className="border-t pt-4 mt-4">{segmenter}</div>` al final de su contenido).
- Es **totalmente opcional por entidad** — si no se pasa, el drawer no renderiza nada extra.

### 2.4 Cómo registrar una entidad nueva

1. Construir el drawer de entidad (`<EntityName>Drawer`) con `mode?: DrawerMode` (§1).
2. Exportarlo desde el barrel de su feature.
3. Agregar el `dynamic()` import + el adaptador en `ENTITY_DRAWERS` (`lib/entity-drawers.tsx`).
4. Verificar que el `label` coincide con `ENTITY_REGISTRY` (entity-identity.md).

---

## 3. `SourceDocumentLink` — drill-down a documentos origen

**Archivo:** `frontend/components/shared/SourceDocumentLink.tsx`
**Import:** `import { SourceDocumentLink } from '@/components/shared'`

Renderiza el link a un documento origen (GFK de [ADR-0016](../10-architecture/adr/0016-post-refactor-architecture-f5.md))
resolviendo en 3 niveles:

```tsx
<SourceDocumentLink doc={{ type: 'sales.saleorder', id: 123, display: 'NV-123' }} />
```

| Prioridad | Condición | Acción |
|-----------|-----------|--------|
| 1 (preferida) | `hasEntityDrawer(doc.type)` | `openEntity(doc.type, doc.id, doc)` — drawer drill-down |
| 2 | `doc.url` presente | `<Link href={doc.url}>` — navegación |
| 3 | ninguna | texto plano, sin interacción |

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `doc` | `{ type: string; id: number; name?: string; display?: string; url?: string }` | ✅ | — | `type` = label `app.model` |
| `showIcon` | `boolean` | ❌ | `true` | |
| `className` | `string` | ❌ | — | |

---

## 4. Relación con los query params (`?selected` / `?detail`)

| Mecanismo | Para qué | Deep-linkeable | Estado |
|-----------|----------|:---:|--------|
| `?selected={id}` ([ADR-0020](../10-architecture/adr/0020-modal-on-list-edit-ux.md)) | editar desde lista / Universal Search | ✅ | **canónico** |
| `openEntity(label, id)` (este contrato) | abrir un drawer de entidad desde cualquier componente (badge, source link, acción de fila sin deep-link) | ❌ (en memoria) | **canónico** |
| `?detail={id}` (cableaba `TransactionViewModal`) | ver documento (solo lectura) | ✅ | **deprecado** — usar `openEntity(label, id)` con `mode='view'` |

> La superficie que monta `?selected` (modal centrado vs drawer embebido) es surface-agnostic — ver
> [ADR-0027](../10-architecture/adr/0027-basedrawer-crud-forms.md). `openEntity` siempre monta el
> drawer registrado en `ENTITY_DRAWERS`.

---

## 5. Anti-patrones

| Anti-patrón | Correcto |
|-------------|----------|
| Reimplementar un modal/drawer local para ver un documento origen | `SourceDocumentLink` o `openEntity(label, id)` |
| `<TransactionViewModal>` (eliminado) | drawer de entidad en modo `view` vía `openEntity` |
| Importar un `*Drawer` y montarlo a mano para drill-down genérico | registrar en `ENTITY_DRAWERS` + `openEntity` |
| `label` distinto entre `ENTITY_DRAWERS` y `ENTITY_REGISTRY` | misma clave `app.model` en ambos |
| Drawer de entidad sin `mode` (dos componentes view/edit separados) | un drawer con `mode?: DrawerMode` |

---

## 6. Cross-references

- ADR de la decisión: [ADR-0028](../10-architecture/adr/0028-entity-drawer-registry.md)
- Primitiva `Drawer` (API, tamaños): [component-drawer.md](./component-drawer.md)
- Identidad de entidad / labels: [entity-identity.md](./entity-identity.md)
- Edición deep-linkeable desde lista: [list-modal-edit-pattern.md](./list-modal-edit-pattern.md)
- Superficie modal vs drawer: [ADR-0027](../10-architecture/adr/0027-basedrawer-crud-forms.md)
