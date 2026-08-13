---
layer: 20-contracts
doc: component-drawer
status: active
owner: frontend-team
last_review: 2026-05-28
stability: contract-changes-require-ADR
supersedes:
  - component-modal.md §BaseDrawer
  - form-layout-architecture.md §Split Layouts, §Form Footer, §Width Constants (drawer parts)
---

# Drawer Component

Única primitiva para paneles modales que se despliegan desde los bordes de la pantalla. Compatible con **formularios CRUD** (create/edit), tablas, históricos y libros mayores. Preserva el contexto visual de la página subyacente.

```tsx
// Drawer lateral izquierdo — formulario CRUD
<Drawer
  open={open}
  onOpenChange={setOpen}
  side="left"
  defaultSize={formDrawerWidth("complex", !!initialData)}
  icon={Tag}
  title="Editar Categoría"
  subtitle="Código: CAT-001"
  footer={
    <FormFooter
      actions={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <ActionSlideButton form="my-form">Guardar</ActionSlideButton>
        </>
      }
    />
  }
>
  <FormSplitLayout
    sidebar={<ActivitySidebar entityId={initialData.id} entityType="category" />}
    showSidebar={!!initialData}
  >
    <form className="space-y-6 px-4 pb-4 pt-4">{/* fields */}</form>
  </FormSplitLayout>
</Drawer>
```

## API

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `title` | `ReactNode \| string` | ✅ | — | Título principal en la cabecera |
| `icon` | `React.ElementType \| ReactNode` | ❌ | — | LucideIcon o ReactNode junto al título |
| `subtitle` | `ReactNode \| string` | ❌ | — | Subtítulo bajo el título |
| `headerActions` | `ReactNode` | ❌ | — | Slot derecho del header (ej. botones de filtro o acciones contextuales) |
| `footer` | `ReactNode` | ❌ | — | Renderizado en contenedor con borde superior. **Usar `FormFooter` en formularios CRUD** |
| `children` | `ReactNode` | ✅ | — | Contenido (formulario, tabla, etc.) |
| `side` | `'top' \| 'right' \| 'bottom' \| 'left'` | ❌ | `'bottom'` | Borde de aparición. Para CRUD forms: `'left'` |
| `boundary` | `'screen' \| 'embedded'` | ❌ | `'embedded'` | `'screen'` → `document.body`. `'embedded'` → `#main-content` / `#module-sheets-portal-container` |
| `defaultSize` | `number \| string` | ❌ | `'400px'` (h) / `'75vh'` (v) | Usar helper `formDrawerWidth()` |
| `minSize` | `number \| string` | ❌ | — | Dimensión mínima |
| `maxSize` | `number \| string` | ❌ | `'100vw'` / `'100vh'` | Dimensión máxima |
| `resizable` | `boolean` | ❌ | `false` | Muestra handle de arrastre en el borde exterior |
| `showOverlay` | `boolean` | ❌ | auto | Fondo oscuro. Auto: `true` si `embedded` y no full-size, `false` si `screen` |
| `mode` | `'create' \| 'edit' \| 'view'` | ❌ | — | En `'view'` aplica fondo distintivo y badge "Vista" |
| `modal` | `boolean` | ❌ | — | Pasa a `SheetContent` (Radix `modal`); `false` permite interacción con el resto de la página |
| `viewportClassName` | `string` | ❌ | — | Clases del viewport interno del `ScrollArea` (contenedor scrolleable) |
| `fillContent` | `boolean` | ❌ | `false` | Si `true`, los children se renderizan en un div flex (sin `ScrollArea`). Útil cuando el contenido (`FormSplitLayout`) maneja su propio scroll y debe llenar todo el alto del body |
| `className` | `string` | ❌ | — | Clases para `SheetContent` |
| `contentClassName` | `string` | ❌ | — | Clases para el área de contenido scrollable (default: `px-8 pb-8`). Usar `p-0` con `FormSplitLayout` |
| `headerClassName` | `string` | ❌ | — | |
| `footerClassName` | `string` | ❌ | — | |
| `titleClassName` | `string` | ❌ | — | |
| `centered` | `boolean` | ❌ | — | Centra el contenido del header (compartido con `BaseModal` via `PanelHeader`) |

> **Nota:** `description` NO es prop de `Drawer` — solo existe en `BaseModal` (`components/shared/BaseModal.tsx`, `description?: ReactNode`). Para texto bajo el título en un Drawer usar `subtitle`. `descriptionClassName` no existe en ningún componente; eliminar cualquier uso.

## Tamaños dinámicos

Usar el helper `formDrawerWidth(complexity, hasSidebar)` de `@/lib/form-widths`. Nunca hardcodear porcentajes.

| `FormComplexity` | Campos | Creación | Edición (con sidebar) |
|:----------------:|:------:|:--------:|:---------------------:|
| `"micro"`   | 1 (ej: GroupForm, TransactionNumberForm) | `25%` | `40%` |
| `"simple"`  | 2–3 (ej: WarehouseForm, UoMForm) | `30%` | `45%` |
| `"medium"`  | 4–6 (ej: AccountForm, AbsenceForm) | `40%` | `55%` |
| `"complex"` | 7+ / múltiples secciones / field arrays | `50%` | `65%` |
| `"master"`  | Ficha maestra multi-tab (ej: ProductForm, EmployeeForm) | `75%` | `90%` |

> **Regla**: si dudás entre dos tiers, elegí el menor. No superar `90%` del viewport.

Implementación:
```tsx
import { formDrawerWidth } from "@/lib/form-widths"

const width = formDrawerWidth("medium", !!initialData?.id)

return (
  <Drawer
    open={open}
    onOpenChange={onOpenChange}
    side="left"
    defaultSize={width}
    contentClassName={initialData ? "p-0" : undefined}
    // ...
  >
```

## Modal equivalente — `formModalSize()`

Para formularios que van en `BaseModal` (no drawer), el helper hermano
`formModalSize(complexity, hasSidebar)` de `@/lib/form-widths` mapea la **misma** `FormComplexity`
a un `size` de `BaseModal`:

| `FormComplexity` | `formModalSize` base | con sidebar (sube un tier) |
|:---:|:---:|:---:|
| `micro` | `xs` | `sm` |
| `simple` | `sm` | `md` |
| `medium` | `md` | `lg` |
| `complex` | `lg` | `xl` |
| `master` | `xl` | `2xl` |

> El enum `FormComplexity` (`micro · simple · medium · complex · master`) es **la taxonomía
> canónica**, definida en `@/lib/form-widths`. Las tablas de dimensionamiento de
> [component-form-patterns.md §2](./component-form-patterns.md) son guías de decisión por nº de
> campos; el valor exacto (ancho del drawer / size del modal) sale de estos helpers, no de nombres ad-hoc.

## Estructura interna del formulario

Para las reglas de layout dentro del drawer (grid de 4 columnas, anchos de campo, `FormSection`, orden semántico), ver **[form-layout-architecture.md](./form-layout-architecture.md)**.

### FormSplitLayout + ActivitySidebar

Cuando el formulario tiene modo edición, usar `FormSplitLayout` con `ActivitySidebar`:

```tsx
<FormSplitLayout
  sidebar={<ActivitySidebar entityId={entity.id} entityType="product" />}
  showSidebar={!!entity?.id}
>
  <form className="space-y-6 px-4 pb-4 pt-4">
    {/* campos */}
  </form>
</FormSplitLayout>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `children` | `ReactNode` | ✅ | — | Contenido principal |
| `sidebar` | `ReactNode` | ❌ | — | Típicamente `ActivitySidebar` |
| `showSidebar` | `boolean` | ❌ | `false` | Solo `true` en edición |
| `sidebarWidth` | `string` | ❌ | `"w-72"` | |
| `className` | `string` | ❌ | — | |

**¿Cuándo mostrar ActivitySidebar?**

| Condición | Decisión |
|:----------|:---------|
| Modo **edición** con `entity?.id` definido | ✅ Siempre mostrar |
| Modo **creación** (sin ID) | ❌ Nunca |
| Drawer de solo lectura (sin formulario) | ❌ No aplica |

> El sidebar solo aparece en el primer tab (`FormTabsContent value="general"`). Los tabs secundarios no lo repiten.

### Padding

| Patrón | `contentClassName` | Padding interno |
|--------|-------------------|-----------------|
| Sin `FormSplitLayout` | no pasar (usa default `px-8 pb-8`) | Lo gestiona el Drawer |
| Con `FormSplitLayout` | `"p-0"` | Lo gestiona `FormSplitLayout` via `px-4 pb-4 pt-2` en el `<form>` |

> **Anti-patrón "double padding"**: no dejar el padding default de Drawer activo cuando `FormSplitLayout` es hijo directo. Siempre `contentClassName="p-0"`.

### Footer

Todo drawer con formulario **debe** pasar un `FormFooter` en la prop `footer`. Nunca `<div>` raw.

```tsx
footer={
  <FormFooter
    leftActions={<DangerButton onClick={handleDelete}>Eliminar</DangerButton>}
    actions={
      <>
        <CancelButton onClick={() => onOpenChange(false)} />
        <ActionSlideButton form="my-form" loading={isPending}>
          Guardar
        </ActionSlideButton>
      </>
    }
  />
}
```

Drawers de solo lectura (sin formulario) pueden omitir el footer o pasar un `<Button>Cerrar</Button>` directo.

> Ver [component-button.md](./component-button.md) para API completa de `CancelButton`, `ActionSlideButton`.  
> Ver [form-layout-architecture.md §FormFooter](./form-layout-architecture.md) para props completas de `FormFooter`.

## Drawers de solo lectura (bottom drawer)

Para subvistas de datos (tablas, libros mayores, históricos) sin formulario:

```tsx
<Drawer
  open={open}
  onOpenChange={setOpen}
  side="bottom"
  defaultSize="75vh"
  title="Libro Auxiliar"
  subtitle="Socio: Juan Pérez"
  icon={History}
>
  <DataTable columns={columns} data={data} />
</Drawer>
```

- `side="bottom"` es el default — no hace falta explicitarlo.
- No usar `FormFooter` ni `FormSplitLayout`.
- Acepta un `<Button>Cerrar</Button>` en footer, o ningún footer.

## Surface treatment (cuadrado, sin radio)

The `SheetContent` shell of the `Drawer` is a **square edge panel**: `border-radius: 0` (`rounded-none`) in **every context** — all sides (`top`/`right`/`bottom`/`left`), both boundaries (`screen`/`embedded`), all modes (`create`/`edit`/`view`), resizable or not, and including the `surface="drawer"` variant of `GenericWizard`, entity drawers, `CostCalculatorDrawer` and `AnalyticsPanel`. See [ADR-0073](../10-architecture/adr/0073-drawers-zero-border-radius.md).

The squareness is enforced at the component level (`rounded-none!` in `components/shared/Drawer.tsx`). **No `rounded-*` class is ever applied to the drawer surface**, and `globals.css` must not reintroduce radius rules for `[data-slot="sheet-content"]` (residual `#main-content … border-*-radius` overrides were removed).

The drawer surface **background is the same as the main content background**: `bg-card` (`--color-card`), in every context and both boundaries. A `Drawer` reads as a contiguous extension of the `<main>` shell (`#main-content` → `flush-panel` → `bg-card`), not as a tinted or translucent panel. The header inherits the panel background (`background-color: inherit`); the `screen` boundary is opaque `bg-card` (no `bg-muted/35 backdrop-blur-sm` frosted treatment). `CollapsibleSheet` (Hub, Inbox, Profile, OrderActionPanel) follows the same surface — see [ADR-0074](../10-architecture/adr/0074-drawers-background-main-content.md). Inner elements (cards, `StatCard`, form sections, `DataTable`) keep their own surface tokens.

> **Do not** pass `border`, `shadow`, `rounded-*` or `bg-*` overrides via `className` on `Drawer`. If a variant is needed, add a new prop that composes with the shared surface treatment instead of replacing it. Passing a `rounded-*` class is blocked by the ESLint rule `drawer/no-rounded` (see `frontend/eslint-rules/drawer-no-rounded.mjs`).

## Excepciones Documentadas

### Formularios con Layout Custom (Fichas Maestras de Múltiples Tabs)

Aunque `FormSplitLayout` es el estándar para edición, existen formularios muy complejos (fichas maestras como `ContactDrawer`) que requieren múltiples tabs a nivel raíz, donde el `ActivitySidebar` solo tiene sentido dentro del primer tab. 

**Regla de excepción:** Si el formulario tiene excesivas secciones que justifican un sistema de navegación por tabs primario, está permitido prescindir de `FormSplitLayout` en el Drawer y colocar el `ActivitySidebar` manualmente dentro de la primera pestaña (`TabBarContent`). Esta es una excepción arquitectural aceptada, documentada y reservada solo para *Master Drawers* que superan las capacidades del Split Layout genérico.
