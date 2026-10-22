---
layer: 20-contracts
doc: component-modal
status: active
owner: frontend-team
last_review: 2026-05-28
stability: contract-changes-require-ADR
---

# Modal Components

Jerarquía de modales del proyecto. Todos los diálogos pertenecen al nivel **Overlay** de la jerarquía de radios (`rounded-lg`) y deben construirse sobre esta familia; **nunca usar `Dialog` de shadcn directamente** en features.

```
BaseModal  (primitiva)
├── ActionConfirmModal   — confirmación de acción (destructiva o no)
├── GenericWizard        — flujo paso a paso
└── DocumentCompletionModal — completar factura con folio + adjunto
```

> **Regla de selección:** usa siempre la especialización más específica.
>
> | Necesito… | Componente |
> |-----------|-----------|
> | Confirmar una acción (destructiva o no) | `ActionConfirmModal` |
> | Flujo paso a paso | `GenericWizard` |
> | Completar factura con folio + adjunto | `DocumentCompletionModal` (ver `component-contracts.md`) |
> | Drawer lateral / formulario CRUD | `Drawer` (ver [component-drawer.md](./component-drawer.md)) |
> | Modal completamente custom | `BaseModal` (directo) |

### ⚠️ Excepciones Autorizadas de Sistema

Existe una única excepción de sistema autorizada para utilizar la primitiva `Dialog` directamente fuera de `BaseModal`:

*   **UniversalSearch (`UniversalSearch.tsx`)**: Al tratarse de la barra de búsqueda global y paleta de comandos (`Ctrl+K`), requiere un comportamiento visual sumamente personalizado que no cumple con el layout de negocio estándar (campo de entrada de texto gigante en el encabezado, segmentadores horizontales y pie de página con atajos de teclado del sistema).

---

## BaseModal 🟢

Primitiva base de todos los modales del proyecto. Wrappea `Dialog` de Shadcn con layout estructurado (header / scroll area / footer), botón de cierre integrado y variantes de estilo.

```tsx
<BaseModal
  open={open}
  onOpenChange={setOpen}
  icon={Tag}
  title="Detalle de orden"
  description="Revisa los datos antes de confirmar"
  size="lg"
  footer={<Button onClick={() => setOpen(false)}>Cerrar</Button>}
>
  <p>Contenido aquí</p>
</BaseModal>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `icon` | `LucideIcon \| ReactNode` | ✅ | — | Icono obligatorio al lado del título |
| `title` | `string \| ReactNode` | ✅ | — | Título obligatorio de la cabecera |
| `description` | `string \| ReactNode` | ❌ | — | Descripción opcional; se alinea horizontalmente con el título |
| `children` | `ReactNode` | ✅ | — | Cuerpo del modal |
| `footer` | `ReactNode` | ❌ | — | Renderizado en `DialogFooter` con fondo transparente |
| `headerActions` | `ReactNode` | ❌ | — | Slot derecho del header (ej. botones de acción extra) |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl' \| 'full'` | ❌ | `'md'` | Ver tabla de anchos abajo |
| `variant` | `'default' \| 'transaction' \| 'wizard' \| 'form-tabs' \| 'raw'` | ❌ | `'default'` | Controla estilos de header/footer |
| `showCloseButton` | `boolean` | ❌ | `true` | Botón X en esquina superior derecha (renderiza `SheetCloseButton` canónico vía `PanelHeader`) |
| `hideScrollArea` | `boolean` | ❌ | `false` | Desactiva `ScrollArea`; obligatorio cuando se usa `TabBar` vertical |
| `allowOverflow` | `boolean` | ❌ | `false` | Permite que el contenido sobresalga (ej. para rieles de pestañas negativos) |
| `className` | `string` | ❌ | — | Clases para `DialogContent` |
| `contentClassName` | `string` | ❌ | — | Clases para el área de contenido (scroll o div) |
| `headerClassName` | `string` | ❌ | — | Clases para el `DialogHeader`. |
| `footerClassName` | `string` | ❌ | — | Clases para el `DialogFooter` |

### Disposición en Dos Filas con Sincronía Vertical y Comportamiento CRUD Dinámico

*   **Disposición y Alineación**: El título y la descripción se disponen en dos filas verticales separadas, pero **sincronizados verticalmente** al inicio de sus textos. El icono obligatorio se coloca a la izquierda del bloque completo, y la columna de texto (título arriba, descripción abajo) se posiciona a la derecha. Esto garantiza que la descripción comience exactamente alineada con el texto del título, sin solaparse ni quedar debajo del icono.
*   **Comportamiento Dinámico (CRUD)**:
    *   **Creación**: El título del modal refleja la acción (ej: `[Icono] Crear Categoría`). La descripción puede omitirse.
    *   **Edición**: El título refleja la entidad y su estado (ej: `[Icono] Ficha de Categoría`). La descripción horizontal muestra dinámicamente detalles identificadores del registro activo (ej: siglas, folio, nombre de fantasía) para dar contexto instantáneo.
*   **Pestañas Dinámicas (`form-tabs`)**: En el caso de formularios con pestañas (`TabBar`), el título o la descripción de la cabecera del modal se actualiza para mostrar el camino de navegación activa (ej: `Editar Producto > Variantes`).

### Invariante de Estados de Carga (Anti-Skeleton)

> [!IMPORTANT]
> **Las cabeceras (headers) y los pies de página (footers) de los modales NUNCA deben usar skeletons ni ser desmontados durante la carga.**
> El esqueleto se debe restringir única y exclusivamente al cuerpo principal (`children`). Esto garantiza estabilidad de layout (CLS) y evita que los botones de acción del footer salten brusca y molestamente.

### Tamaños (`size`)

| Valor | Ancho máximo |
|-------|-------------|
| `xs` | 400 px |
| `sm` | 500 px |
| `md` | 700 px |
| `default` | 512 px (Shadcn base, `sm:max-w-lg`) |
| `lg` | 900 px |
| `xl` | 1200 px |
| `2xl` | 1400 px |
| `full` | 98 vw × 95 vh |

### Variantes (`variant`)

| Valor | Efecto visual |
|-------|---------------|
| `default` | Header con borde inferior, footer con fondo transparente. Icono obligatorio y alineación horizontal. |
| `transaction` | Header con `bg-primary text-primary-foreground` (sin borde). Para cabeceras de detalle de transacción |
| `wizard` | Header con `border-b pb-2`. Usado internamente por `GenericWizard` |
| `form-tabs` | Header transparente adaptado para pestañas dinámicas. Título + Descripción horizontalmente dinámicos. |
| `raw` | Sin bordes ni cabecera; sin `ScrollArea`. Para layouts totalmente custom |

States handled: — (sin estado propio; estado lo gestiona el componente padre).

### Footer estándar

Todo modal que contenga un formulario **debe** pasar un `FormFooter` en la prop `footer`. Nunca usar `<div>` raw.

```tsx
footer={
  <FormFooter
    actions={
      <>
        <CancelButton onClick={() => onOpenChange(false)} />
        <SubmitButton loading={isPending} form="my-form-id">
          Guardar
        </SubmitButton>
      </>
    }
  />
}
```

Para modales de solo lectura (sin formulario) se acepta un `<Button>Cerrar</Button>` directo.

> Ver [component-button.md](./component-button.md) para la API completa de `CancelButton` y `SubmitButton`.
> Ver [form-layout-architecture.md §5](./form-layout-architecture.md) para la API completa de `FormFooter`.

---

## ActionConfirmModal 🟢

Reusable confirmation dialog with variant styling and async confirmation support.

```tsx
<ActionConfirmModal
  open={open}
  onOpenChange={setOpen}
  onConfirm={handleDelete}
  title="Eliminar orden"
  description="Esta acción no se puede deshacer."
  variant="destructive"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `onConfirm` | `() => Promise<void> \| void` | ✅ | — | Shows spinner during async |
| `title` | `string` | ✅ | — | |
| `description` | `ReactNode` | ✅ | — | Accepts JSX |
| `confirmText` | `string` | ❌ | `'Confirmar'` | |
| `cancelText` | `string` | ❌ | `'Cancelar'` | |
| `variant` | `'default' \| 'destructive' \| 'warning' \| 'info' \| 'success'` | ❌ | `'default'` | Controls icon + button color |
| `icon` | `LucideIcon` | ❌ | — | Overrides default variant icon |

States handled: loading (during `onConfirm`), error (console only — caller manages toast).

---

## GenericWizard 🟢

Multi-step wizard, built on `BaseModal`, `Drawer` or a bare inline layout.
Handles step navigation, validation, sidebars and the success screen. It is
the canonical shell for every multi-step flow (notes, purchasing checkout,
sales checkout, production work orders); prefer it over bespoke step machines.

```tsx
<GenericWizard
  open={open}
  onOpenChange={setOpen}
  title="Crear Orden"
  steps={[
    { id: 1, title: 'Datos', component: <Step1 />, isValid: step1Valid },
    { id: 2, title: 'Líneas', component: <Step2 />, onNext: validateStep2 },
  ]}
  onComplete={handleComplete}
  completeButtonLabel="Crear"
  isCompleting={isPending}
  // v2 — three-column layout with render-prop sidebars
  leftSidebar={({ step, totalSteps }) => <ProcessRail current={step} total={totalSteps} />}
  rightSidebar={<OrderSummary items={items} />}
/>
```

```typescript
interface WizardStep {
  id: string | number
  title: string
  description?: string
  component: ReactNode
  isValid?: boolean               // disables Next when false
  onNext?: () => Promise<boolean | void>  // return false to block advance
}

// Render context handed to render-prop slots (leftSidebar / rightSidebar / footer)
interface WizardRenderContext {
  step: number          // 0-based
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  goNext: () => Promise<void>
  goBack: () => void
  goTo: (index: number) => void
}

type WizardSlot = ReactNode | ((ctx: WizardRenderContext) => ReactNode)

// Imperative handle (for external navigation, e.g. a POS header)
interface GenericWizardHandle {
  goNext: () => Promise<void>
  goBack: () => void
  goTo: (index: number) => void
  finish: () => Promise<void>
  step: number          // 0-based
  totalSteps: number
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `title` | `string \| ReactNode` | ✅ | — | Modal title |
| `steps` | `WizardStep[]` | ✅ | — | Min 1 step |
| `onComplete` | `() => Promise<void>` | ✅ | — | Called on last step confirm |
| `onClose` | `() => void` | ❌ | — | Called on cancel/close |
| `initialStep` | `number` | ❌ | `0` | Zero-indexed |
| `completeButtonLabel` | `string` | ❌ | `'Completar'` | |
| `completeButtonIcon` | `ReactNode` | ❌ | — | |
| `isCompleting` | `boolean` | ❌ | `false` | Spinner on complete button |
| `isLoading` | `boolean` | ❌ | `false` | Full wizard loading state |
| `successContent` | `ReactNode` | ❌ | — | Shown after `onComplete` resolves |
| `footerLeft` | `ReactNode` | ❌ | — | Left slot in footer |
| `touchMode` | `boolean` | ❌ | `false` | Pantalla táctil: step counter, título y footer agrandados (targets ≥ 48px). Usar con `useTouchMode()` |
| `onStepChange` | `(index: number) => void` | ❌ | — | Notifica el paso activo (0-indexed) al avanzar/retroceder/saltar |
| `surface` | `'modal' \| 'drawer' \| 'inline'` | ❌ | `'modal'` | `'inline'` no monta chrome: el consumidor pinta header/footer |
| `drawerSide` | `'top' \| 'right' \| 'bottom' \| 'left'` | ❌ | `'right'` | Solo con `surface='drawer'` |
| `drawerBoundary` | `'screen' \| 'embedded'` | ❌ | `'embedded'` | Solo con `surface='drawer'` |
| `subtitle` | `ReactNode` | ❌ | — | Reemplaza el contador industrial `01 / 03 — Título` del header |
| `leftSidebar` | `WizardSlot` | ❌ | — | Rail izquierdo (oculto < `md`). Acepta nodo o render prop |
| `rightSidebar` | `WizardSlot` | ❌ | — | Rail derecho (oculto < `lg`). Acepta nodo o render prop |
| `leftSidebarWidth` | `string` | ❌ | `'w-64'` | Clase de ancho del rail izquierdo |
| `rightSidebarWidth` | `string` | ❌ | `'w-80'` | Clase de ancho del rail derecho |
| `footer` | `WizardSlot \| null` | ❌ | — | Reemplaza el footer de navegación. `null` = sin footer |
| `contentClassName` | `string` | ❌ | — | Clases extra del contenedor scrolleable del paso |
| `bodyClassName` | `string` | ❌ | — | Clases extra de la columna central |
| `handleRef` | `Ref<GenericWizardHandle>` | ❌ | — | Handle imperativo (navegación externa) |

Inherits `BaseModal` props except `children`, `title`, `description`, `footer`.

When any sidebar slot is present the wizard owns scrolling (`hideScrollArea`
in modal mode, `fillContent` in drawer mode) and lays out three columns:
rail izquierdo · contenido · rail derecho.

States handled: loading (isLoading), step blocked (isValid=false or onNext returns false), completing (isCompleting), success (successContent).

### Sidebar primitives

The rails are meant to be composed from two shared building blocks (both
re-exported from `@/components/shared`):

- **`WizardStepsSidebar`** — step rail. Props: `title`, `currentStep` (1-based),
  `steps: WizardSidebarStep[]` (with `status: 'active' | 'past' | 'future'`,
  `disabled`, `icon`, `detail`, `className`), `onStepClick(index)` (0-based),
  `renderStepActions(step, index)`, `width`, `footer`.
- **`WizardSummarySidebar`** — summary rail. Props: `header`, `body`, `footer`,
  `side: 'left' | 'right'` (drives the separator border), `width`,
  `scrollAreaClassName`.

Domain-rich rails become **thin adapters** over these two: e.g. production's
`WizardProcessSidebar` maps per-stage governance onto `status` + `disabled` +
`renderStepActions`, and `WizardRightSidebar` delegates its shell to
`WizardSummarySidebar`.

### Surface recipes

- **Modal (default)** — the canonical wizard modal; sidebars optional.
- **Drawer** — `surface="drawer"` + `drawerSide`/`drawerBoundary`; used by the
  notes and purchasing checkout flows.
- **Inline** — `surface="inline"`; the wizard renders only the columns and an
  optional footer. Use `footer={null}` and `handleRef` when navigation lives
  outside (e.g. the POS header + cart footer driving the sales checkout).

### Single source of truth for navigation

GenericWizard keeps its own step index. When the domain component already owns
a step machine (a hook or imperative view), do **not** let both advance:
mirror the domain index into `initialStep` and delegate the footer (`footer`
render prop or `handleRef`) back to the domain. Two independent machines
double-advance.

---

## Drawer

Los **paneles laterales modales** se construyen con el componente `Drawer` de `@/components/shared`.  
Ver **[component-drawer.md](./component-drawer.md)** para:
- API completa del componente
- Tamaños dinámicos según complejidad (`formDrawerWidth()`)
- Layout de formulario interno (grid, `FormSplitLayout`, `FormFooter`, `ActivitySidebar`)
- Patrón para drawers de solo lectura

