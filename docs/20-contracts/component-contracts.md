---
layer: 20-contracts
doc: component-contracts
status: active
owner: frontend-team
last_review: 2026-04-23
stability: contract-changes-require-ADR
---

# Component Contracts

Public API of every shared component in `components/shared/`. Consumers import only what's documented here. Changing a prop requires ADR.

## Legend

- 🟢 Stable — safe to use
- 🟡 Beta — API may still change
- 🔴 Pendiente de contrato — read source before use
- Columns: `prop` | `type` | `required` | `default` | `notes`

---

## BaseModal 🟢

Primitiva base de todos los modales del proyecto. Wrappea `Dialog` de Shadcn con layout estructurado (header / scroll area / footer), botón de cierre integrado y variantes de estilo.

> **No consumir directamente en features salvo casos excepcionales.**  
> Preferir las especializaciones según el caso:
>
> | Necesito… | Componente |
> |-----------|-----------|
> | Confirmar una acción (destructiva o no) | `ActionConfirmModal` |
> | Flujo paso a paso | `GenericWizard` |
> | Completar factura con folio + adjunto | `DocumentCompletionModal` |
> | Modal completamente custom | `BaseModal` (directo) |

```tsx
<BaseModal
  open={open}
  onOpenChange={setOpen}
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
| `title` | `string \| ReactNode` | ✅ | — | Si se omite se inyecta `sr-only` para a11y |
| `description` | `string \| ReactNode` | ❌ | — | `asChild` si no es string |
| `children` | `ReactNode` | ✅ | — | Cuerpo del modal |
| `footer` | `ReactNode` | ❌ | — | Renderizado en `DialogFooter` con fondo `muted/20` |
| `headerActions` | `ReactNode` | ❌ | — | Slot derecho del header (ej. botones de acción extra) |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl' \| 'full' \| 'default'` | ❌ | `'default'` | Ver tabla de anchos abajo |
| `variant` | `'default' \| 'transaction' \| 'wizard' \| 'raw'` | ❌ | `'default'` | Controla estilos de header/footer |
| `showCloseButton` | `boolean` | ❌ | `true` | Botón X en esquina superior derecha |
| `hideScrollArea` | `boolean` | ❌ | `false` | Desactiva `ScrollArea`; útil cuando el hijo gestiona su propio scroll |
| `className` | `string` | ❌ | — | Clases para `DialogContent` |
| `contentClassName` | `string` | ❌ | — | Clases para el área de contenido (scroll o div) |
| `headerClassName` | `string` | ❌ | — | Clases para el `DialogHeader` |
| `footerClassName` | `string` | ❌ | — | Clases para el `DialogFooter` |

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
| `default` | Header con borde inferior, footer con `bg-muted/20` |
| `transaction` | Header con `bg-primary text-primary-foreground` (sin borde). Usado en `TransactionViewModal` |
| `wizard` | Header con `border-b pb-2`. Usado internamente por `GenericWizard` |
| `raw` | Sin bordes en header ni footer; sin `ScrollArea`. Para layouts totalmente custom |

States handled: — (sin estado propio; estado lo gestiona el componente padre).

---

## StatusBadge 🟢

Only authorized component for rendering entity states. No ad-hoc badges allowed.

```tsx
<StatusBadge variant="sale-order" status="in_production" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `variant` | `'sale-order' \| 'purchase-order' \| 'work-order' \| 'invoice' \| 'payment' \| 'generic'` | ✅ | — | Maps to state-map entity |
| `status` | entity-specific union (see [state-map](state-map.md)) | ✅ | — | Must be valid for variant |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | `'md'` | 40px min height `md`+ |
| `className` | `string` | ❌ | — | Merged via `cn()` |

States handled: — (pure presentational, no async).

---

## Skeleton family 🟢

Los componentes de esta familia manejan los estados de carga de la aplicación. Es **CRÍTICO** utilizarlos correctamente para evitar "layout shifts" (brincos en la pantalla) y reducir el código repetitivo.

### 🎭 Regla de Oro: Suspense vs Refetching

El proyecto define dos momentos distintos para los estados de carga, y cada uno usa una estrategia diferente:

#### 1. Carga Inicial (First-Load / Suspense)
Cuando el usuario navega a una ruta nueva y no hay datos.
- **Usa:** Wrappers estáticos (`TableSkeleton`, `FormSkeleton`, `CardSkeleton`).
- **Por qué:** No tienes datos para renderizar el DOM real, así que debes dibujar un "mock" estático que imite la estructura final.

#### 2. Recarga (Refetching / Mutations / Filters)
Cuando el usuario ya está en la vista, la tabla existe, y solo está filtrando o cambiando de página.
- **Usa:** `SkeletonShell` envolviendo tu componente real.
- **Por qué:** Evita desmontar el componente real para poner un esqueleto. El Shell le aplica un "shimmer" (brillo CSS) por encima al DOM existente, congelando la interacción pero manteniendo exactamente el mismo layout. ¡Cero brincos!

---

### 🚫 Antipatrones: Skeletons "Ad-hoc"

Está **estrictamente prohibido** el uso excesivo del componente primitivo `<Skeleton />` directamente en las features (ej. `<Skeleton className="h-4 w-32" />`).
- **Problema:** Infla el código de negocio con clases de Tailwind de diseño y rompe la consistencia.
- **Solución:** Si necesitas cargar una tabla, usa `<TableSkeleton />`. Si es una vista muy caprichosa (ej. el Header de un perfil), crea un archivo `ProfileHeaderSkeleton.tsx` encapsulando los primitivos, en lugar de mezclarlos con el código de negocio.

---

### 📦 Catálogo de Wrappers Compartidos

#### `CardSkeleton`
| prop | type | default | notes |
|------|------|---------|-------|
| `count` | `number` | `3` | Número de tarjetas a renderizar |
| `variant` | `'grid' \| 'list' \| 'product' \| 'compact'` | `'grid'` | `product`: con imagen; `compact`: lista slim |
| `gridClassName` | `string` | — | Configuración custom de grid (ej. `grid-cols-4`) |
| `className` | `string` | — | Clases para el contenedor principal |

#### `TableSkeleton`
| prop | type | default | notes |
|------|------|---------|-------|
| `rows` | `number` | `5` | Filas de la tabla |
| `columns` | `number` | `5` | Columnas por fila |
| `className` | `string` | — | Clases para el contenedor principal |

#### `FormSkeleton`
| prop | type | default | notes |
|------|------|---------|-------|
| `fields` | `number` | `4` | Cantidad de campos de formulario por bloque |
| `cards` | `number` | `1` | Número de bloques/tarjetas lado a lado (1-4) |
| `hasTabs` | `boolean` | `false` | Renderiza un tab-bar en la parte superior |
| `tabs` | `number` | `3` | Cantidad de tabs simulados (si `hasTabs` es true) |

#### `SkeletonShell`
| prop | type | default | notes |
|------|------|---------|-------|
| `isLoading` | `boolean` | **Obligatorio** | Activa la animación shimmer y `aria-busy` |
| `children` | `ReactNode` | **Obligatorio** | El DOM real a "congelar" con el efecto |

#### `PageLayoutSkeleton` (Layout Family) 🆕
Wrappers de alto nivel para estandarizar la carga de rutas completas.

- **`PageHeaderSkeleton`**: Mock de la barra superior (Título + Descripción + Acciones).
- **`PageTabsSkeleton`**: Mock de la barra de navegación por pestañas.
- **`ToolbarSkeleton`**: Mock de la barra de herramientas de tablas (Búsqueda + Botones).
- **`HubSkeleton`**: Mock especializado para el Command Center (Hub) con sus 4 fases verticales.

| prop | type | default | notes |
|------|------|---------|-------|
| `hasTabs` | `boolean` | `false` | Incluye `PageTabsSkeleton` |
| `tabsCount` | `number` | `3` | Cantidad de pestañas en el skeleton |
| `hasToolbar` | `boolean` | `false` | Incluye `ToolbarSkeleton` |
| `contentType` | `'table' \| 'card' \| 'form' \| 'custom'` | `'table'` | Define el cuerpo del skeleton |

---

## EmptyState 🟢

```tsx
<EmptyState
  icon={<PackageIcon />}
  title="Sin órdenes"
  description="Crea la primera para empezar"
  action={<Button>Crear</Button>}
/>
```

| prop | type | required |
|------|------|----------|
| `icon` | `ReactNode` | ❌ |
| `title` | `string` | ✅ |
| `description` | `string` | ❌ |
| `action` | `ReactNode` | ❌ |

---

## PageHeader 🟢

| prop | type | required | notes |
|------|------|----------|-------|
| `title` | `string` | ✅ | uses `font-heading` |
| `subtitle` | `string` | ❌ | |
| `breadcrumbs` | `Array<{label; href?}>` | ❌ | |
| `actions` | `ReactNode` | ❌ | Right-aligned |
| `tabs` | `ReactNode` | ❌ | Below title |
| `backHref` | `string` | ❌ | Renders chevron-left |

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

## DataManagement 🟢

Toolbar group: export CSV, download template, import CSV.

```tsx
<DataManagement
  onExport={handleExport}
  onImport={handleImport}
  templateData={[{ nombre: '', rut: '' }]}
  onImportSuccess={refetch}
  exportFilename="productos"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `onExport` | `() => Promise<void>` | ✅ | — | Called on Export click |
| `onImport` | `(formData: FormData) => Promise<void>` | ✅ | — | FormData key: `file` |
| `templateData` | `Record<string, unknown>[]` | ✅ | — | First row keys = CSV headers |
| `onImportSuccess` | `() => void` | ✅ | — | Called after successful import |
| `exportFilename` | `string` | ❌ | `'export'` | Filename without extension |

States handled: loading per button (export, import), error toast on failure.

---

## DatePicker 🟢

Single date selector. Spanish locale (es-CL).

```tsx
<DatePicker date={date} onDateChange={setDate} placeholder="Selecciona fecha" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `date` | `Date \| undefined` | ❌ | — | Controlled |
| `onDateChange` | `(date?: Date) => void` | ✅ | — | Returns `undefined` on clear |
| `placeholder` | `string` | ❌ | `'Selecciona fecha'` | |
| `className` | `string` | ❌ | — | |
| `disabled` | `boolean` | ❌ | `false` | |

States handled: — (pure controlled).

---

## DateRangeFilter 🟢

Two-month range picker for table filters.

```tsx
<DateRangeFilter onRangeChange={setRange} label="Período" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `onRangeChange` | `(range: DateRange \| undefined) => void` | ✅ | — | `DateRange` from `react-day-picker` |
| `label` | `string` | ❌ | `'Rango de fechas'` | Shown when no range selected |
| `defaultRange` | `DateRange` | ❌ | — | Initial range |
| `className` | `string` | ❌ | — | |

States handled: — (pure controlled, clear button built-in).

---

## DocumentAttachmentDropzone 🟢

Drag-and-drop file input with DTE-aware required logic.

```tsx
<DocumentAttachmentDropzone
  file={file}
  onFileChange={setFile}
  dteType="FACTURA"
  isPending={false}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `file` | `File \| null` | ✅ | — | Controlled |
| `onFileChange` | `(file: File \| null) => void` | ✅ | — | |
| `dteType` | `string` | ❌ | — | Required for all except `BOLETA`/`NONE` when not `isPending` |
| `isPending` | `boolean` | ❌ | `false` | Overrides required check |
| `disabled` | `boolean` | ❌ | `false` | |
| `label` | `string` | ❌ | `'Documento'` | |
| `requiredOverride` | `boolean` | ❌ | — | Force required regardless of dteType |
| `accept` | `string` | ❌ | `'.pdf,.xml,image/*'` | MIME/extension filter |

States handled: file selected, drag-over highlight, remove.

---

## DocumentCompletionModal 🟢

Modal to complete an invoice with folio, date, and optional attachment. Validates tax and accounting periods before submit.

```tsx
<DocumentCompletionModal
  open={open}
  onOpenChange={setOpen}
  invoiceId={42}
  invoiceType="FACTURA"
  onComplete={handleComplete}
  onSuccess={refetch}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `invoiceId` | `number` | ✅ | — | |
| `invoiceType` | `string` | ✅ | — | DTE type string (e.g. `'FACTURA'`) |
| `onComplete` | `(invoiceId: number, formData: FormData) => Promise<void>` | ✅ | — | FormData keys: `number`, `date`, `document_attachment?` |
| `onSuccess` | `() => void` | ❌ | — | Called after `onComplete` resolves |
| `contactId` | `number` | ❌ | — | Passed to folio uniqueness check |
| `isPurchase` | `boolean` | ❌ | `false` | Switches folio check to purchase scope |

States handled: loading (submit), folio validation async, period validation async. Attachment required when `invoiceType === 'FACTURA'`.

---

## FacetedFilter 🟢

Multi-select popover for table column filtering.

```tsx
<FacetedFilter
  title="Estado"
  options={[{ label: 'Activo', value: 'active' }]}
  selectedValues={selected}
  onSelect={setSelected}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `title` | `string` | ❌ | — | Popover trigger label |
| `options` | `Array<{ label: string; value: string; icon?: ComponentType<{ className?: string }> }>` | ✅ | — | |
| `selectedValues` | `string[]` | ✅ | — | Controlled |
| `onSelect` | `(values: string[]) => void` | ✅ | — | Full updated array |

States handled: — (pure controlled). Shows count badge when >2 selected; shows inline labels when ≤2.

---

## FolioValidationInput 🟢

Text input with real-time DTE folio uniqueness validation.

```tsx
<FolioValidationInput
  value={folio}
  onChange={setFolio}
  dteType="FACTURA"
  contactId={contactId}
  onValidityChange={(isValid) => setFolioValid(isValid)}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `string` | ✅ | — | Controlled |
| `onChange` | `(value: string) => void` | ✅ | — | |
| `dteType` | `string` | ✅ | — | DTE type for uniqueness scope |
| `contactId` | `number` | ❌ | — | Narrows uniqueness scope |
| `isPurchase` | `boolean` | ❌ | `false` | Switches to purchase folio scope |
| `excludeId` | `number` | ❌ | — | Exclude invoice id from check (edit mode) |
| `onValidityChange` | `(isValid: boolean, result: FolioValidationResult \| null) => void` | ❌ | — | Fires after each validation |
| `label` | `string` | ❌ | `'Folio'` | |
| `placeholder` | `string` | ❌ | — | |
| `className` | `string` | ❌ | — | |
| `autoFocus` | `boolean` | ❌ | `false` | |
| `disabled` | `boolean` | ❌ | `false` | |

```typescript
interface FolioValidationResult {
  is_unique: boolean
  message: string
}
```

States handled: validating (spinner), valid (check icon), duplicate (warning icon + alert).

---

## PeriodValidationDateInput 🟢

DatePicker wrapper that validates tax/accounting period closure before accepting a date.

```tsx
<PeriodValidationDateInput
  date={date}
  onDateChange={setDate}
  validationType="both"
  onValidityChange={setDateValid}
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `date` | `Date \| undefined` | ✅ | — | Controlled |
| `onDateChange` | `(date: Date \| undefined) => void` | ✅ | — | |
| `onValidityChange` | `(isValid: boolean) => void` | ❌ | — | Fires after each validation |
| `validationType` | `'tax' \| 'accounting' \| 'both'` | ❌ | `'both'` | Which periods to check |
| `label` | `string` | ❌ | `'Fecha'` | |
| `placeholder` | `string` | ❌ | — | |
| `className` | `string` | ❌ | — | |
| `disabled` | `boolean` | ❌ | `false` | |
| `required` | `boolean` | ❌ | `false` | |

States handled: validating (spinner), period closed (warning alert, isValid=false).

---

## MoneyDisplay 🟢

Single source of truth for money rendering. Tabular, monospace, locale-aware.

```tsx
<MoneyDisplay amount={150000} colored />
<MoneyDisplay amount={null} showZeroAsDash />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `amount` | `number \| string \| null \| undefined` | ✅ | — | null/undefined/NaN → dash |
| `currency` | `string` | ❌ | `'CLP'` | ISO 4217 |
| `colored` | `boolean` | ❌ | `false` | Red < 0, green > 0 |
| `showZeroAsDash` | `boolean` | ❌ | `false` | 0 renders as `—` |
| `className` | `string` | ❌ | — | |
| `digits` | `number` | ❌ | locale default | Decimal places override |
| `inline` | `boolean` | ❌ | `false` | `display: inline` vs `inline-block` |

Font: always `font-mono font-bold tabular-nums`. Do NOT render currency with raw JS `.toLocaleString()` outside this component.

---

## GenericWizard 🟢

Multi-step wizard modal. Handles step navigation, validation, and success screen.

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

Inherits `BaseModal` props except `children`, `title`, `description`, `footer`.

States handled: loading (isLoading), step blocked (isValid=false or onNext returns false), completing (isCompleting), success (successContent).

---

## ReportTable 🟢

Hierarchical accounting report table. Supports tree expand/collapse and comparison periods.

```tsx
<ReportTable
  data={nodes}
  title="Balance General"
  totalLabel="Total Activos"
  totalValue={5000000}
  showComparison
  periodLabel="Abr 2026"
  compPeriodLabel="Abr 2025"
  accentColor="primary"
/>
```

```typescript
interface ReportNode {
  id: number | string
  code: string
  name: string
  balance: number
  comp_balance?: number    // comparison period balance
  variance?: number        // pre-computed variance (optional)
  children?: ReportNode[]  // nested accounts
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `data` | `ReportNode[] \| null` | ✅ | — | null triggers loading/empty state |
| `title` | `string` | ❌ | — | Table caption |
| `totalLabel` | `string` | ❌ | `'Total'` | Footer row label |
| `totalValue` | `number` | ❌ | — | Footer row balance |
| `totalValueComp` | `number` | ❌ | — | Footer comparison balance |
| `showComparison` | `boolean` | ❌ | `false` | Adds comp column + variance |
| `embedded` | `boolean` | ❌ | `false` | Removes card wrapper |
| `isLoading` | `boolean` | ❌ | `false` | Shows `ReportTableSkeleton` |
| `periodLabel` | `string` | ❌ | — | Column header |
| `compPeriodLabel` | `string` | ❌ | — | Comparison column header |
| `mode` | `'tree' \| 'flat'` | ❌ | `'tree'` | Flat disables expand |
| `accentColor` | `'primary' \| 'success' \| 'info' \| 'destructive'` | ❌ | `'primary'` | Total row accent |

Also exports `ReportTableSkeleton` for suspense boundaries.

States handled: loading (isLoading → ReportTableSkeleton), empty (EmptyState), populated.

---

## CollapsibleSheet 🟢

Side panel with collapsible tab. Supports multi-sheet stacking via `GlobalModalProvider`.

```tsx
<CollapsibleSheet
  sheetId="order-detail"
  open={open}
  onOpenChange={setOpen}
  tabLabel="Detalle"
  tabIcon={FileTextIcon}
  size="lg"
>
  <OrderDetail id={id} />
</CollapsibleSheet>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `children` | `ReactNode` | ✅ | — | Sheet content |
| `sheetId` | `string` | ✅ | — | Unique ID for stacking z-index |
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `tabLabel` | `string` | ✅ | — | Vertical tab text when collapsed |
| `tabIcon` | `LucideIcon` | ✅ | — | Tab icon |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | ❌ | `'md'` | sm=442px, md=682px, lg=882px, xl=1082px, full=100vw |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right'` | ❌ | `'right'` | |
| `className` | `string` | ❌ | — | |
| `forceCollapse` | `boolean` | ❌ | `false` | Keep tab visible even when open |
| `fullWidth` | `number` | ❌ | — | Override size with px value |
| `hideOverlay` | `boolean` | ❌ | `false` | No backdrop |
| `pushOffset` | `number` | ❌ | — | Pixel offset for stacking |

Requires `GlobalModalProvider` in layout for correct z-index stacking.
DOM unmounts 500ms after close for exit animation.

---

## CommentSystem 🟢

Comment thread with scrollable feed and keyboard-submit input.

```tsx
<CommentSystem
  comments={comments}
  onAddComment={handleAddComment}
  placeholder="Escribe un comentario..."
  maxHeight="300px"
/>
```

```typescript
interface Comment {
  user: string       // displayed as 2-letter avatar initials
  text: string
  timestamp: string  // ISO string, formatted es-CL locale
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `comments` | `Comment[]` | ✅ | — | |
| `onAddComment` | `(text: string) => void` | ✅ | — | Text already trimmed |
| `placeholder` | `string` | ❌ | `'Escribe un comentario...'` | |
| `emptyMessage` | `string` | ❌ | `'Sin comentarios'` | EmptyState title |
| `className` | `string` | ❌ | — | |
| `maxHeight` | `string` | ❌ | `'400px'` | Feed scroll container |

Submit: `Enter` submits, `Shift+Enter` inserts newline.

States handled: empty (EmptyState), populated.

---

## AttachmentList 🟢

File attachment grid with download link and optional delete.

```tsx
<AttachmentList
  attachments={attachments}
  onDelete={handleDelete}
  isDeleting={deletingId}
/>
```

```typescript
interface Attachment {
  id: number
  file: string                    // URL
  original_filename: string
  file_size_formatted: string     // pre-formatted by backend, e.g. "42 KB"
  uploaded_at: string             // ISO string
  user_name?: string
  mime_type?: string
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `attachments` | `Attachment[]` | ✅ | — | |
| `onDelete` | `(id: number) => void` | ❌ | — | Omit to hide delete button |
| `isDeleting` | `number \| null` | ❌ | `null` | ID of attachment being deleted |
| `className` | `string` | ❌ | — | |

Layout: 1 col mobile, 2 col `sm+`. Download opens new tab.
States handled: empty (EmptyState), deleting per-item spinner.

---

## ToolbarCreateButton 🟢

Primary toolbar action button. Renders as link when `href` provided.

```tsx
<ToolbarCreateButton label="Nueva Orden" icon={PlusCircleIcon} onClick={handleOpen} />
<ToolbarCreateButton label="Nuevo Producto" href="/inventory/products/new" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | Uppercase bold text |
| `icon` | `LucideIcon` | ❌ | `Plus` | Direct icon component |
| `iconName` | `string` | ❌ | — | Dynamic icon by string name; `icon` takes precedence |
| `href` | `string` | ❌ | — | Renders as Next.js `<Link>` instead of `<button>` |

Inherits all `Button` props except `children`. Variant defaults to `default` (primary). Height 9 (36px).

---

## PageTabs 🟢

Industrial underline navigation tabs with optional subtab dropdowns.

```tsx
<PageTabs
  tabs={[
    { value: 'orders', label: 'Órdenes', iconName: 'ClipboardList', href: '/sales' },
    { value: 'sessions', label: 'Sesiones', iconName: 'Monitor', href: '/sales/sessions',
      subTabs: [{ value: 'active', label: 'Activas', href: '/sales/sessions?status=active' }] },
  ]}
  activeValue="orders"
/>
```

```typescript
interface TabConfig {
  value: string
  label: string
  iconName: string          // DynamicIcon name
  href: string
  subTabs?: SubTabConfig[]  // renders dropdown chevron
}

interface SubTabConfig {
  value: string
  label: string
  href: string
  iconName?: string
}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `tabs` | `TabConfig[]` | ✅ | — | |
| `activeValue` | `string` | ✅ | — | Matches `TabConfig.value` |
| `subActiveValue` | `string` | ❌ | — | Matches `SubTabConfig.value` |
| `maxWidth` | `string` | ❌ | — | Container max-width |
| `className` | `string` | ❌ | — | |
| `variant` | `'default' \| 'minimal'` | ❌ | `'default'` | minimal reduces padding |
| `configHref` | `string` | ❌ | — | Adds gear icon link at right |

Tabs scroll horizontally on small screens (no scrollbar).

---

## TransactionViewModal 🟢

Large detail modal for any transaction type. Two-column layout: content (75%) + metadata sidebar (25%).

```tsx
<TransactionViewModal
  open={open}
  onOpenChange={setOpen}
  type="sale-order"
  id={orderId}
  view="all"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `type` | `TransactionType` | ✅ | — | See TransactionType union |
| `id` | `number \| string` | ✅ | — | Entity ID |
| `view` | `'details' \| 'history' \| 'all'` | ❌ | `'all'` | Which panels to render |

`TransactionType` union: covers sale orders, purchase orders, invoices, payments, work orders — see source for full union. Uses `useTransactionData(type, id)` internally.

Features: print (react-to-print), navigation history between related transactions (`useNavigationHistory`), inline payment editing, delete payment confirmation.

States handled: loading (dual spinner), error, populated.

---

## Forbidden usage

- Creating a new badge component instead of using `StatusBadge`.
- Passing raw Tailwind color classes to any shared component.
- Modifying `/components/ui/` (Shadcn base).
- Calling `.toLocaleString()` for money formatting — use `MoneyDisplay`.
- Rendering currency in tables without `MoneyDisplay` (breaks tabular alignment).
