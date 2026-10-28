---
layer: 20-contracts
doc: component-entity-drawers
status: active
owner: frontend-team
last_review: 2026-10-09
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

| Modo | Cuándo | Comportamiento | Ruta de apertura |
|------|--------|----------------|-----------------|
| `create` | sin `initialData`/`id` | formulario vacío, footer "Crear {Entidad}" | `openEntity` o montaje directo |
| `edit` | con `initialData`/`id` | pre-fill, dirty tracking, footer "Guardar Cambios" | **exclusivamente** vía `?selected={id}` (ADR-0020) |
| `view` | lectura | campos read-only, sin footer de edición; reemplaza al difunto `TransactionViewModal` | `openEntity` (del registro) |

> **Importante:** `ENTITY_DRAWERS` y `openEntity` solo abren drawers en modo `view` (o `create` si no hay `id`). El modo `edit` **jamás** se alcanza desde el registro — es exclusivo del patrón `?selected` que monta el drawer directamente con `initialData` de la lista. No pasar `mode="edit"` en adaptadores de `ENTITY_DRAWERS`.

- Un drawer **deriva** el modo con el hook canónico: `const { mode, isView } = useDrawerMode({ mode: modeProp, initialData })`. **Jamás resolver el modo inline**.
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
  ssr: false, loading: () => skeleton("orden de venta"),
})

export const ENTITY_DRAWERS = {
  "sales.saleorder": ({ id, open, onOpenChange }) => (
    <SaleOrderDrawer id={id} open={open} onOpenChange={onOpenChange} />
  ),
  "contacts.contact": ({ id, data, open, onOpenChange, onSuccess }) => (
    <ContactDrawer contact={data ?? { id }} open={open} onOpenChange={onOpenChange} onSuccess={onSuccess} />
  ),
  // … 37 entidades registradas
}
```

> El `label` es la clave Django `app.model` — la **misma** que usa `ENTITY_REGISTRY`
> ([entity-identity.md](./entity-identity.md)). Mantenelas alineadas.

> **Prop canónico `id`:** los transaction drawers extienden `TransactionDrawerProps` (`id: number | null` requerido) y resuelven `id ?? <specificId>` internamente. En el adaptador pasá **`id={id}`** — no el alias específico (`orderId`/`invoiceId`/…), que solo existe por compatibilidad y deja el `id` requerido sin setear. El adaptador de `ENTITY_DRAWERS` DEBE usar `id`, `initialData` (o `data`) y `onSuccess` estandarizados. Nunca mapear a eventos custom como `onSaved` o `onUpdate`.

> **Una sola estrategia de datos:** Un drawer elige UNA estrategia de datos. O recibe `initialData` (objeto completo provisto por la lista) y NO hace fetch interno, o recibe un `id` y hace su propio fetch. JAMÁS mezclar `initialData` y fetch interno (evita doble fuente de verdad).

### 2.2 Opener — `GlobalModalProvider`

**Archivo:** `frontend/components/providers/GlobalModalProvider.tsx` (montado una sola vez en el layout autenticado)

```ts
const { openEntity, closeEntity, hasEntityDrawer } = useGlobalModals()

openEntity('sales.saledelivery', 123)                    // abre el drawer registrado (modo derivado)
openEntity('contacts.contact', 7, contactObj)            // con datos pre-fetcheados
openEntity('inventory.stockmove', 9, undefined, undefined, { display: 'MOV-9' })
closeEntity()   // cierra todas las pestañas
goBackEntity()  // vuelve al documento anterior
```

| API | Tipo | Notas |
|-----|------|-------|
| `openEntity` | `(label, id, data?, segmenter?, options?: { display?: string }) => void` | Advierte en consola (no rompe) si no hay drawer registrado. `options.display` es el texto que verá el "Volver a …" del documento que se abra encima |
| `closeEntity` | `() => void` | Cierra **todas** las pestañas (documentos y herramientas) |
| `openTool` | `(tool: ToolTabId) => void` | Abre una herramienta como pestaña (`"cost-calculator"`) |
| `activateTab` / `closeTab` | `(key: string) => void` | Activan/cierran una pestaña, con guarda de cambios sin guardar |
| `openRootEntity` / `closeEntityByRef` | `(label, id) => void` | Pestaña de la selección de una lista (`?selected`); sin guarda, la aplicó quien llama |

**Pestañas efímeras (ADR-0101, sustituye la pila y las migas de ADR-0080/0100).** `openEntity` abre el documento como **pestaña** en la barra de trabajo permanente (`WorkspaceTabBar`, bajo la topbar) o activa la pestaña si ya está abierta (máx. 8). Solo se monta el drawer de la pestaña activa; el provider no envuelve nada: los drawers no necesitan cambios. Cerrar (X / Escape / × de la pestaña / `onSuccess`) cierra la pestaña activa y activa a su vecina, con guarda. Las pestañas se cierran al cambiar de página y no se serializan en la URL. `closeEntity` cierra todas. La Calculadora de Costos es otra pestaña (`openTool("cost-calculator")`) y conserva su estado mientras exista. `?selected` es una sola pestaña, la fila explorada: elegir otra la reemplaza y cerrarla limpia `?selected`.

**Drawers que monta la página (edición `?selected`, creación `?modal=new`).** Dos piezas, siempre juntas:

```tsx
const panel = useEntityPanelRoute<Contact>({ endpoint: '/contacts', external: { open: externalOpen, onOpenChange } })
<EntityPanelTab label="contacts.contact" {...panel.tab}>
  {(open) => <ContactDrawer open={open} contact={panel.entity ?? undefined} onOpenChange={(o) => { if (!o) panel.close() }} />}
</EntityPanelTab>
```

- `useEntityPanelRoute` (`@/hooks`) es el **único** lugar que lee `?selected` / `?action` / `?modal=new`, carga el registro (`endpoint`, vía `useSelectedEntity`) y cierra (`close`: limpia los tres params, con guarda de cambios sin guardar). Las vistas **no** escriben `handleClose*`, `isCreateOpen` ni `router.replace` a mano.
- Varios paneles sobre una ruta se separan con `actions` (`[null, 'detail']`, `['disburse']`, `['view']`); `create: false` en los paneles que no crean; `enabled` / `resolved` cubren pestañas de la página y selecciones que la vista resuelve de sus filas.
- `EntityPanelTab` (`@/components/providers`) registra la pestaña mientras `open`, muestra el drawer solo con su pestaña activa y a tamaño completo, y llama `onClose` al cerrar la pestaña. `id = null` = creación. Para estado no ligado a la URL (p. ej. libro de crédito) se pasan `id`/`open`/`onClose` a mano.
- Alcance: **todo lo que crea o edita una entidad** es pestaña (drawers, wizards y modales de formulario). Quedan como overlay las acciones puntuales sobre un registro (pagar, depositar, cerrar sesión/año/periodo, confirmaciones, historiales y detalles de solo lectura).
- Parámetros propios: `selectedParam` / `createValue` (`selected-device`, `modal=new-device`, `modal=batch`). Dos paneles del mismo registro se distinguen con `variant` en `EntityPanelTab`.
- Un `BaseModal` (y por tanto un `GenericWizard` en `surface="modal"`) montado dentro de `EntityPanelTab` se renderiza solo como panel a tamaño completo (`PersistentPanelContext`); no hay que reescribirlo como `Drawer`.

**Ficha documental (ADR-0083, revierte D4).** Los documentos abren su ficha documental ([component-document-sheet.md](./component-document-sheet.md)): OV y OC → `OrderSheet`, factura/nota → `InvoiceSheet` (U2–U3; `SaleOrderDrawer`, `PurchaseOrderDrawer` e `InvoiceDrawer` eliminados). Ningún label redirige al Order Hub. Las fichas documentales **no** reciben `onSuccess` en su adaptador: sus acciones no deben cerrar la pila.

**`LazyDrawer` (legacy, GAP-12).** `DRAWER_MAP` se retiró: `LazyDrawer({ type, id, open, onOpenChange })` traduce el `docType` snake_case (`TYPE_TO_REGISTRY` + `service_obligation`, `inventory_document`) al label y renderiza el adaptador de `ENTITY_DRAWERS`. Hay un solo registro de fichas. Para código nuevo usar `openEntity`.

**Asientos por id.** `openEntity('accounting.journalentry', id)` sin `data` abre el asiento en **modo vista** cargado por id (antes abría el formulario de creación). Sin `data` ni `id` → creación.
| `useGlobalModals()` | hook | Acciones + estado de stacking de sheets (offsets de `CollapsibleSheet`) |
| `useGlobalModalActions()` | hook | Solo acciones (sin re-render por estado de sheets) |

> **Histórico:** los openers `openWorkOrder(id)`, `openContact(id, data?)` y `openTreasuryAccount(id)` fueron **eliminados** — todo pasa por `openEntity(label, id, data?)`. No reintroducirlos.

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
<SourceDocumentLink doc={{ type: 'sales.saleorder', id: 123, display: 'OV-123' }} />
```

| Prioridad | Condición | Acción |
|-----------|-----------|--------|
| 1 | `hasEntityDrawer(doc.type)` | `openEntity(doc.type, doc.id, undefined, undefined, { display })` — ficha como pestaña del espacio de trabajo ([ADR-0100](../10-architecture/adr/0100-document-drilldown-stack-without-navigation.md), [ADR-0101](../10-architecture/adr/0101-workspace-tab-bar.md)) |
| 2 | `doc.url` presente | `<Link href={doc.url}>` — navegación |
| 3 | ninguna | texto plano, sin interacción |

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `doc` | `{ type: string; id: number; name?: string; display?: string; url?: string }` | ✅ | — | `type` = label `app.model` |
| `showIcon` | `boolean` | ❌ | `true` | |
| `className` | `string` | ❌ | — | |

---

## 4. Checklist de Drawer CRUD canónico (Template)

Todos los drawers deben adherirse a esta estructura unificada:

- [ ] Usa `useDrawerMode({ mode: modeProp, initialData })` (no resolución inline de modo)
- [ ] Usa `useDrawerIdentity` para título, subtítulo e icono
- [ ] Usa `formDrawerWidth(complexity, !!initialData?.id)` para el ancho
- [ ] Reset de form: `useInitializeDrawerForm` (layout effect con reset key `open` + id; sin `form.reset()` durante render ni `useEffect` después del paint) — ver [component-state-sync.md](./component-state-sync.md)
- [ ] Mutaciones: usa hook dedicado `use*Mutations()` (ej. `useCategoryMutations`) que invoca `markLocalMutation()` e `invalidateCrossFeature()`. Cero `api.*()` directos en el componente.
- [ ] `FormSplitLayout` + `ActivitySidebar` con `showSidebar={!!initialData?.id}` (solo para edición)
- [ ] `FormFooter` canónico (o ausente si drawer read-only)
- [ ] `contentClassName="p-0"` cuando usa `FormSplitLayout`
- [ ] Callbacks estandarizados: Usa `onSuccess` (no `onSaved`, no `onUpdate`)
- [ ] Cierre tras guardar **dentro** del callback de `form.handleSubmit` (`await` de la mutación → `onSuccess` → cerrar). Un guardado que pide confirmación vuelve a entrar con `form.handleSubmit(save)()` desde el modal (ver §5, guarda)
- [ ] Registrado en `ENTITY_DRAWERS` si necesita apertura global desde link

---

## 5. Relación con los query params (`?selected` / `?detail`)

| Mecanismo | Para qué | Deep-linkeable | Estado |
|-----------|----------|:---:|--------|
| `?selected={id}` ([ADR-0020](../10-architecture/adr/0020-modal-on-list-edit-ux.md)) | editar desde lista / Universal Search | ✅ | **canónico** |
| `openEntity(label, id)` (este contrato) | abrir un drawer de entidad desde cualquier componente (badge, source link, acción de fila sin deep-link) | ❌ (en memoria) | **canónico** |
| `?detail={id}` (cableaba `TransactionViewModal`) | ver documento (solo lectura) | ✅ | **deprecado** — usar `openEntity(label, id)` con `mode='view'` |

> La superficie que monta `?selected` (modal centrado vs drawer embebido) es surface-agnostic — ver
> [ADR-0027](../10-architecture/adr/0027-basedrawer-crud-forms.md). `openEntity` siempre monta el
> drawer registrado en `ENTITY_DRAWERS`.

### 5.2 Drilldown de documento: navegar vs apilar

Las superficies de drilldown documental (`useOpenRelatedDocument` —filas del tab Relaciones—,
`SourceDocumentLink`, `DocumentRefLink`) delegan en **un solo punto**: `useOpenDocument()`
(`@/hooks/useOpenDocument`). Ninguna superficie decide por su cuenta.

**Drill-down** ([ADR-0100](../10-architecture/adr/0100-document-drilldown-stack-without-navigation.md), sin flag):

- Con ficha registrada: **apilar** con `openEntity(label, id, undefined, undefined, { display })`. La lista de
  origen, el módulo y la URL **no cambian**; "Volver a …" regresa al documento anterior.
- Sin ficha registrada: `router.push(DocumentRef.url)`.

La URL canónica (`DocumentRef.url`, [ADR-0080](../10-architecture/adr/0080-document-model-relations-and-navigation.md) §6)
sigue siendo la vía de enlaces externos, búsqueda universal y `/d/…`. Predicados: `opensInApp` y
`canOpenDocument` en `@/hooks/useOpenDocument`.

**Guarda de cambios sin guardar (siempre activa).** Un formulario de drawer con cambios pendientes bloquea abrir
otro documento, "Volver", cerrar y salir de la página hasta elegir *Guardar y continuar*, *Descartar y continuar*
o *Seguir editando* (`UnsavedChangesDialog`). Los drawers con formulario la reciben gratis vía
`useInitializeDrawerForm`; el resto de rutas (`useEntityRouteActions`, `useSelectedEntity`) pasan por
`runGuarded` de `GlobalModalProvider`.

**El cierre del guardado no pasa por la guarda solo si ocurre durante el envío.** `useDirtyGuard` cuenta el
formulario como limpio mientras corre el callback de `form.handleSubmit` (el espejo de `isDirty` llega un render
tarde). Si el drawer cierra fuera de esa ventana — `setTimeout`, `mutate(…, { onSuccess })` sin `await`, o un
guardado lanzado desde un modal de confirmación — la guarda ve el formulario sucio, muestra *Cambios sin
guardar* y la pestaña no se cierra (y *Guardar y continuar* reenvía). En desarrollo el provider lo avisa con
`console.warn("[useDirtyGuard] …")` cuando bloquea a menos de 1 s del fin de un envío del mismo formulario.

### 5.1 Detalle de entidad = overlay siempre-recargable (reglas de foco y URL)

El detalle de una entidad **no** es una página canónica: es la **lista + overlay** apuntado por
`?selected={id}` ([ADR-0020](../10-architecture/adr/0020-modal-on-list-edit-ux.md)). Estas reglas
son las que lo hacen operar como un detalle real (DET-02):

**URL / deep-link**

- La URL canónica de un detalle es SIEMPRE la lista con `?selected={id}`. No hay ruta de detalle
  que renderice contenido: `/contacts/1` es un `redirect()` server-side a `/contacts?selected=1`.
- Al incorporar una entidad con detalle: un server component en `app/(dashboard)/<módulo>/[id]/page.tsx`
  que hace `redirect(`${listUrl}?selected=${id}`)` (ver `contacts/[id]/page.tsx`).
- `clearSelection` (cierre) usa `router.replace` — sin entrada de historial falsa. Cambiar de
  `?selected=a` a `?selected=b` convive con la historia de la lista (back/forward de la lista, no
  del overlay).

**Recarga / "siempre-recargable"**

- `?selected=` es state-en-URL: un F5/reload vuelve a montar el overlay con la entidad seleccionada.
  El hook canónico `useSelectedEntity` re-fetchea `${endpoint}/${id}/` y reutiliza la cache de
  TanStack Query si la lista ya cargó el mismo id (contrato `list-modal-edit-pattern.md` §2.3).
- Al cambiar `?selected=` de un id a otro, la lista NO se re-monta; solo se actualiza el overlay.

**Foco**

- Abrir el overlay (clic de fila o deep-link): el foco entra en el drawer (primer campo /
  encabezado). La primitiva `Sheet` (Radix Dialog) aplica `aria-modal` y body-scroll-lock.
- Cerrar (Escape / X / click-outside): el foco vuelve al trigger de la lista que lo abrió. Si el
  overlay se abrió por deep-link (sin trigger), el foco vuelve al primer foco útil de la lista.
- Navegar entre ids mantiene el foco dentro del drawer.

**Título / bookmarks**

- `document.title` de la lista debe reflejar la entidad seleccionada (p.ej. "Cliente #123 —
  Contactos") para que bookmarks y links compartidos sean legibles al reabrir.

> Estas reglas son surface-agnostic (modal centrado vs drawer embebido) — [ADR-0027](../10-architecture/adr/0027-basedrawer-crud-forms.md).

---

## 6. Anti-patrones

| Anti-patrón | Correcto |
|-------------|----------|
| Reimplementar un modal/drawer local para ver un documento origen | `SourceDocumentLink` o `openEntity(label, id)` |
| `<TransactionViewModal>` (eliminado) | drawer de entidad en modo `view` vía `openEntity` |
| Importar un `*Drawer` y montarlo a mano para drill-down genérico | registrar en `ENTITY_DRAWERS` + `openEntity` |
| Página de detalle propia que renderiza contenido (`[id]/page.tsx` con UI) | server `redirect('${listUrl}?selected=${id}')` (ADR-0020, §5.1) |
| Cerrar el overlay con `router.push` (deja historial falso) | `clearSelection` (`router.replace`) del hook `useSelectedEntity` |
| `label` distinto entre `ENTITY_DRAWERS` y `ENTITY_REGISTRY` | misma clave `app.model` en ambos |
| Drawer de entidad sin `mode` (dos componentes view/edit separados) | un drawer con `mode?: DrawerMode` |
| Calcular modo manualmente: `mode ?? (initialData ? "view" : "create")` | Usar `useDrawerMode({ mode, initialData })` |
| Combinar `initialData` con fetch interno (`useQuery` dentro del drawer) | Elegir UNA estrategia: O `initialData`, O fetch con `id` |
| `handleClose*` / `isCreateOpen` / `useSelectedEntity` + `router.replace` escritos en cada vista | `useEntityPanelRoute` + `EntityPanelTab` |
| Adaptador con aliases: `<Drawer accountId={id} onSaved={onSuccess} />` | Estandarizar props en el Drawer a `id` y `onSuccess` |
| Cerrar tras guardar con `setTimeout(() => onOpenChange(false), …)` o en `mutate(…, { onSuccess })` sin `await` | `await` de la mutación y cerrar dentro del callback de `handleSubmit` |
| Modal de confirmación que llama `save(pendingValues)` directo | `onConfirm={() => void form.handleSubmit(save)()}` |

---

## 7. Cross-references

- ADR de la decisión: [ADR-0028](../10-architecture/adr/0028-entity-drawer-registry.md); pila, "volver" y OV/OC → Hub: [ADR-0080](../10-architecture/adr/0080-document-model-relations-and-navigation.md)
- Documentos relacionados y URL canónica: [document-relations.md](./document-relations.md)
- Primitiva `Drawer` (API, tamaños): [component-drawer.md](./component-drawer.md)
- Identidad de entidad / labels: [entity-identity.md](./entity-identity.md)
- Edición deep-linkeable desde lista: [list-modal-edit-pattern.md](./list-modal-edit-pattern.md)
- Superficie modal vs drawer: [ADR-0027](../10-architecture/adr/0027-basedrawer-crud-forms.md)
