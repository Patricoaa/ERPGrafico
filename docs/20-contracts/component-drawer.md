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
          <SubmitButton form="my-form">Guardar</SubmitButton>
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

> **Botón de cierre:** `Drawer` renderiza internamente `PanelHeader` con `onClose={() => onOpenChange(false)}`, lo que muestra el `SheetCloseButton` canónico (circular ghost 32px) en la esquina superior derecha del header. No pasar `hideCloseButton` ni `showCloseButton` — se controla automáticamente. Ver [component-contracts.md #SheetCloseButton](./component-contracts.md#SheetCloseButton-🟢) y [ADR-0091](../10-architecture/adr/0091-single-close-button.md).

> **Nota:** `description` NO es prop de `Drawer` — solo existe en `BaseModal` (`components/shared/BaseModal.tsx`, `description?: ReactNode`). Para texto bajo el título en un Drawer usar `subtitle`. `descriptionClassName` no existe en ningún componente; eliminar cualquier uso.

## Tamaños dinámicos

Usar el helper `formDrawerWidth(complexity, hasSidebar)` de `@/lib/form-widths`. Nunca hardcodear porcentajes.

**Excepción:** `defaultSize="100%"` está autorizado para wizards `side="bottom"` con `boundary="embedded"` que ocupan el viewport completo (ej: `WorkOrderWizard`, `UnifiedNoteWizard`, `PurchaseCheckoutWizard`).

> Los wizards de notas (`UnifiedNoteWizard`) y compras (`PurchaseCheckoutWizard`) usan `Drawer` + `DrawerLayout`
> con rail de pasos (`DrawerResizableRail` + `WizardStepsSidebar`) y rail de resumen colapsable; ver
> [ADR-0143](../10-architecture/adr/0143-wizard-de-notas-sobre-drawer-layout.md). `GenericWizard`
> (`surface="drawer"`) se reserva para wizards sin rail de proceso; API en **[component-modal.md](./component-modal.md)**.

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

### DrawerLayout (Layout Centralizado con Rieles y Tabs)

`DrawerLayout` es el componente estructural canónico para el interior de cualquier `Drawer` complejo o con rieles. Centraliza el manejo de rieles (izquierdo y derecho) y la barra de pestañas (`TabBar`), garantizando que:
1. **Las pestañas superiores van arriba a ancho completo** (inmediatamente debajo del header del Drawer).
2. **Los rieles (izquierdo y derecho) y el workspace central se sitúan bajo las pestañas**.
3. **Alineación del contenido**: Los items de las pestañas inician visualmente alineados con la columna del workspace/contenido central (desplazados si hay un riel izquierdo).
4. **Fondo uniforme `bg-card`**: Header, tabs, riel izquierdo (stepper OT), contenido/workspace y footer comparten `bg-card`.
5. **Variante de pestañas estándar**: `underline` con acentos de color CMYK.
6. **Padding por defecto**: `p-6` en cada tab, desactivable con `noPadding: true`.
7. **Riel derecho colapsable** con persistencia en `localStorage`.
8. **`forceMount` seguro**: una pestaña con `forceMount: true` permanece montada (conserva su estado local al cambiar de pestaña) pero `DrawerLayout` la oculta cuando está inactiva (`data-[state=inactive]:hidden`). Radix no aplica el atributo `hidden` a los paneles con `forceMount`, por lo que sin esa regla el contenido del panel inactivo se renderiza dentro del workspace de la pestaña activa.
9. **Modo vista con `contentDisabled`**: para deshabilitar los campos en modo vista, pasa `contentDisabled={isView}`. `DrawerLayout` envuelve **solo el workspace central** en un `<fieldset disabled>`. **No** envuelvas el `DrawerLayout` en un `<fieldset disabled>` propio, porque deshabilitaría también las tabs y los rieles, y el riel derecho aloja componentes que deben seguir activos en modo vista, como los comentarios de `EntitySidebar` ([ADR-0111](../10-architecture/adr/0111-entity-comments.md)).

```tsx
import { DrawerLayout, type DrawerLayoutTab } from "@/components/shared"

const tabs: DrawerLayoutTab[] = [
  {
    value: "general",
    label: "General",
    icon: Package,
    content: <GeneralForm />,
  },
  {
    value: "inventory",
    label: "Inventario",
    icon: Warehouse,
    content: <InventoryTable />,
    noPadding: true, // para vistas densas o tablas
  },
]

return (
  <Drawer open={open} onOpenChange={onOpenChange} contentClassName="p-0" fillContent>
    <DrawerLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      leftRail={<ProcessStepper />} // opcional
      rightRail={<ActivitySidebar entityId={id} entityType="product" />}
      rightRailCollapsible
      rightRailStorageKey="erpgrafico.drawer.sidebar.product"
    />
  </Drawer>
)
```

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `tabs` | `DrawerLayoutTab[]` | `undefined` | Definición de pestañas con su contenido |
| `activeTab` / `onTabChange` | `string` / `(tab: string) => void` | `undefined` | Control del tab activo |
| `defaultTab` | `string` | primer tab | Tab inicial no controlado |
| `children` | `ReactNode` | `undefined` | Contenido si no se usan tabs |
| `leftRail` | `ReactNode` | `undefined` | Riel izquierdo (stepper, árbol de categorías, etc.) |
| `leftRailWidth` | `string` | `"w-48"` | Ancho del riel izquierdo |
| `leftRailBorder` | `boolean` | `true` | Borde derecho divisorio |
| `leftRailRaw` | `boolean` | `false` | Renderiza `leftRail` directamente sin envoltorio `<aside>` |
| `rightRail` | `ReactNode` | `undefined` | Riel derecho (`ActivitySidebar`, tareas, etc.) |
| `rightRailWidth` | `string` | `"w-72"` | Ancho del riel derecho |
| `rightRailCollapsible` | `boolean` | `false` | Habilita botón de colapso con chevron y pestaña iconificada |
| `rightRailStorageKey` | `string` | `undefined` | Clave localStorage para persistir el colapso |
| `rightRailDefaultCollapsed` | `boolean` | `false` | Estado inicial colapsado |
| `rightRailRaw` | `boolean` | `false` | Renderiza `rightRail` directamente sin envoltorio `<aside>` |
| `noPadding` | `boolean` | `false` | Elimina el `p-6` del workspace por defecto |
| `contentClassName` | `string` | `undefined` | Clases adicionales para el contenedor de contenido |

### FormSplitLayout (Adaptador retrocompatible)

`FormSplitLayout` es ahora un adaptador que delega internamente en `DrawerLayout`. Los 25+ formularios existentes en la base de código continúan funcionando sin cambios de API:

```tsx
<FormSplitLayout
  sidebar={<ActivitySidebar entityId={entity.id} entityType="product" />}
  showSidebar={!!entity?.id}
  collapsible
  collapseStorageKey="erpgrafico.drawer.sidebar.entity"
>
  <form className="space-y-6 px-4 pb-4 pt-4">
    {/* campos */}
  </form>
</FormSplitLayout>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `children` | `ReactNode` | ✅ | — | Contenido principal |
| `sidebar` | `ReactNode` | ❌ | — | Típicamente `ActivitySidebar` (o composición de `CollapsibleSection`) |
| `showSidebar` | `boolean` | ❌ | `false` | Solo `true` en edición |
| `sidebarWidth` | `string` | ❌ | `"w-72"` | |
| `collapsible` | `boolean` | ❌ | `false` | Habilita riel colapsable OT-style |
| `collapseStorageKey` | `string` | ❌ | — | Clave localStorage para persistir estado colapsado |
| `defaultCollapsed` | `boolean` | ❌ | `false` | Estado inicial colapsado |
| `className` | `string` | ❌ | — | |

> **Composición interna del sidebar**: `ActivitySidebar` renderiza internamente sobre `CollapsibleSection`, permitiendo apilar futuras secciones colapsables (Comentarios, Adjuntos, etc.) en el mismo panel lateral sin romper la estructura.

**¿Cuándo mostrar ActivitySidebar?**

| Condición | Decisión |
|:----------|:---------|
| Modo **edición** con `entity?.id` definido | ✅ Siempre mostrar |
| Modo **creación** (sin ID) | ❌ Nunca |
| Drawer de solo lectura (sin formulario) | ❌ No aplica |

> El sidebar solo aparece en el primer tab (`TabBarContent value="general"`). Los tabs secundarios no lo repiten.

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
        <SubmitButton form="my-form" loading={isPending}>
          Guardar
        </SubmitButton>
      </>
    }
  />
}
```

Drawers de solo lectura (sin formulario) pueden omitir el footer o pasar un `<Button>Cerrar</Button>` directo.

> Ver [component-button.md](./component-button.md) para API completa de `CancelButton`, `SubmitButton`.  
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

## Tratamiento de superficie (panel de borde plano)

El `Drawer` es un **panel de borde**: plano, sin radio ni sombra, `bg-card`, con borde hairline solo en el lado que limita con el contenido. Es el mismo nivel que el `<main>` de `DashboardShell` (`flush-panel`) y `CollapsibleSheet` (shell ERPNext v16, ADR-0079). Ver [geometry-surfaces.md §2](./geometry-surfaces.md).

`sideStyles` en `components/shared/Drawer.tsx` fija `rounded-none!` y quita el borde del lado pegado al borde de pantalla (o al shell):

| `side` | overrides |
|--------|-----------|
| `'right'` | `rounded-none! border-l-0!` (+ `border-l border-border/40` si no es `embedded`) |
| `'left'`  | `rounded-none! border-r-0!` (+ `border-r border-border/40` si no es `embedded`) |
| `'bottom'` | `rounded-none! border-t-0!` |
| `'top'`   | `rounded-none! border-b-0!` |

Con `boundary="embedded"` el panel se posiciona `absolute` con `border border-border/40 bg-card`.

> **No** pases `border`, `shadow`, `rounded-*` ni `bg-*` por `className` al `Drawer`. Si hace falta una variante, añade una prop que componga con `sideStyles`.

## Excepciones Documentadas

### Formularios con Layout Custom (Fichas Maestras de Múltiples Tabs)

Aunque `FormSplitLayout` es el estándar para edición, existen formularios muy complejos (fichas maestras como `ContactDrawer`) que requieren múltiples tabs a nivel raíz, donde el `ActivitySidebar` solo tiene sentido dentro del primer tab. 

**Regla de excepción:** Si el formulario tiene excesivas secciones que justifican un sistema de navegación por tabs primario, está permitido prescindir de `FormSplitLayout` en el Drawer y colocar el `ActivitySidebar` manualmente dentro de la primera pestaña (`TabBarContent`). Esta es una excepción arquitectural aceptada, documentada y reservada solo para *Master Drawers* que superan las capacidades del Split Layout genérico.
