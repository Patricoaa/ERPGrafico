---
layer: 20-contracts
doc: component-contracts
status: active
owner: frontend-team
last_review: 2026-05-06
stability: contract-changes-require-ADR
---

# Component Contracts

## Legend

- 🟢 Stable — safe to use
- 🟡 Beta — API may still change
- 🔴 Pendiente de contrato — read source before use
- Columns: `prop` | `type` | `required` | `default` | `notes`

> 📄 **System-wide Contract**: For entity prefixes, icons, and labels, see **[entity-identity.md](./entity-identity.md)**.

---

## Selector components

> See **[component-selectors.md](./component-selectors.md)** for AccountSelector, ProductSelector, AdvancedWorkOrderSelector, and 7 more.

---

## Table Cell Input (excepción documentada)

> 📄 Documentación completa en **[component-table-cell-input.md](./component-table-cell-input.md)**.

Patrón de `<Input>` de shadcn **sin notched** dentro de `<TableCell>`. Es la única excepción autorizada para no usar `LabeledInput` en un formulario con datos editables.
Shell components: `FormLineItemsTable` · `AccountingLinesTable`.

---

## BaseModal / ActionConfirmModal / GenericWizard

> 📄 Documentación completa en **[component-modal.md](./component-modal.md)**.

Jerarquía: `BaseModal` (primitiva) → `ActionConfirmModal` | `GenericWizard` | `DocumentCompletionModal`.
Nunca usar `Dialog` de shadcn directamente en features.



---

## Dropdown & Popover Layout Invariants

Global rules for positioning and width of floating UI elements to ensure consistency across the design system.

### 1. Width Invariant (Match Trigger)
Every dropdown or popover used within a form field (Select, Selector, Combobox) MUST match the width of its trigger by default.
- **CSS Rule**: Use `w-[var(--radix-select-trigger-width)]` or `w-[var(--radix-popover-trigger-width)]`.
- **Reasoning**: Maintains the "solid block" aesthetic of the form layout.
- **Exception**: Filters in toolbars or specialized components like `DateRangeFilter` (see [component-datepicker.md](./component-datepicker.md)).

### 2. Positioning vs. Notched Fields
The positioning relative to a `notched-field` (fieldset + legend) depends on the component type:
- **Covering (Default Selects)**: Standard `LabeledSelect` uses `item-aligned` positioning. The dropdown aligns with the top legend/border, covering the trigger.
- **Floating (Entity Selectors)**: Feature-rich selectors (`AccountSelector`, `ProductSelector`) use `popper` positioning. The dropdown aligns with the bottom border of the fieldset to avoid obscuring search inputs or rich triggers.

---

## Chip 🟢

Single authorized component for **non-status, non-entity-ID** informational labels: type tags, category pills, count indicators, feature flags.

> 📄 Contrato completo en **[component-chip.md](./component-chip.md)**.

```tsx
<Chip>Almacenable</Chip>
<Chip size="xs" intent="warning">CREDITO</Chip>
<Chip size="md" intent="success" icon={ShieldCheck}>BOM ACTIVA</Chip>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `size` | `'xs' \| 'sm' \| 'md'` | ❌ | `'sm'` | xs=18px, sm=22px, md=26px |
| `intent` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'destructive' \| 'primary'` | ❌ | `'neutral'` | |
| `icon` | `LucideIcon` | ❌ | — | Same color as text |
| `className` | `string` | ❌ | — | Layout/position only — never override typography |

Typography invariant: `font-mono font-black uppercase tracking-widest`. Decision boundary: workflows → `StatusBadge`; entity IDs → `EntityBadge`; everything else → `Chip`.

---

## StatusBadge 🟢

Only authorized component for rendering entity states. No ad-hoc badges allowed.
> 📄 Para la resolución de íconos y títulos de entidad, ver **[entity-identity.md](./entity-identity.md)**.

```tsx
<StatusBadge variant="sale-order" status="in_production" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `variant` | `'sale-order' \| 'purchase-order' \| 'work-order' \| 'invoice' \| 'payment' \| 'generic'` | ✅ | — | Maps to state-map entity |
| `status` | entity-specific union (see [state-map](state-map.md)) | ✅ | — | Must be valid for variant |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | `'sm'` | sm=h-6/12px (tables), md=h-8/14px (modals), lg=h-10/base (detail) |
| `className` | `string` | ❌ | — | Merged via `cn()` |

States handled: — (pure presentational, no async).

---

## Skeleton family

> 📄 Documentación completa en **[component-skeleton.md](./component-skeleton.md)**.

Catálogo: `CardSkeleton` · `TableSkeleton` · `FormSkeleton` · `SkeletonShell` · `PageLayoutSkeleton` · `LoadingFallback`.
Regla clave: usar wrappers estáticos para first-load, `SkeletonShell` para refetching.

---

## EmptyState 🟢

```tsx
<EmptyState
  icon={<PackageIcon />}
  title="Sin órdenes"
  description="Crea la primera para empezar"
  action={<Button>Crear</Button>}
  variant="full"
  context="inventory"
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `icon` | `ReactNode` | ❌ | — | Sobrescribe el icono del contexto |
| `title` | `string` | ❌ | — | Título principal. Si se omite, se usa el por defecto del `context` |
| `description` | `string` | ❌ | — | Descripción detallada debajo del título |
| `context` | `EmptyStateContext` | ❌ | `'generic'` | Define icono y título por defecto. Valores: `'search' \| 'inventory' \| 'finance' \| 'users' \| 'generic' \| 'database' \| 'production' \| 'pos' \| 'bom' \| 'treasury' \| 'sale' \| 'purchase'` |
| `variant` | `'full' \| 'compact' \| 'minimal'` | ❌ | `'full'` | `full`: icono grande con bordes. `compact`: padding reducido. `minimal`: inline flex. |
| `entityName` | `string` | ❌ | — | Personaliza el título auto-generado (ej. "No hay órdenes para {entityName}") |
| `action` | `ReactNode` | ❌ | — | Acción principal (derecha/abajo) |
| `secondaryAction` | `ReactNode` | ❌ | — | Acción secundaria (izquierda/arriba) |
| `className` | `string` | ❌ | — | Clases adicionales para el contenedor |

---

## DataTable & ExpandableTableRow 🟢

> 📄 Documentación completa de arquitectura y vistas en **[component-datatable-views.md](./component-datatable-views.md)**.

Sistema central de tablas de datos y sus primitivas de vista.

| componente | uso principal | variant / prop clave |
|---|---|---|
| `DataTable` | Tabla principal, maneja paginación y skeleton automático | `variant="embedded" | "standalone"` |
| `EntityCard` | Shell estandarizado para vistas de tarjeta/grilla | `variant="default" | "compact"` |
| `ExpandableTableRow` | Fila con panel de detalle desplegable (lazy fetch) | `onExpand`, `cellClassName` |

---

## ActionDock 🟡

Floating taskbar for multi-selection actions and summary statistics. Automatically adjusts its horizontal position when Hub or Inbox panels are open.

```tsx
<ActionDock isVisible={selectedIds.length > 0}>
  <ActionDock.Stats>
    <ActionDock.Stat label="Seleccionados" value={selectedIds.length} />
    <ActionDock.Stat label="Total" value={formatCurrency(total)} colorClass="text-primary" />
  </ActionDock.Stats>
  
  <ActionDock.Actions>
    <Button onClick={handleBatchAction}>Procesar</Button>
  </ActionDock.Actions>
</ActionDock>
```

### ActionDock Props
| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `isVisible` | `boolean` | ✅ | — | Triggers entrance/exit animation |
| `className` | `string` | ❌ | — | Merged into main container |

### Sub-components
- **`ActionDock.Section`**: Generic container for custom tools (e.g. suggestions).
- **`ActionDock.Stats`**: Rounded container for numeric data.
- **`ActionDock.Stat`**: Individual metric (`label` | `value` | `colorClass?`).
- **`ActionDock.Actions`**: Button container with left border separator.

States handled: entry/exit animations via `AnimatePresence`. Responsive centering via `MutationObserver` on `body`.

---

## PageHeader 🟢

> 📄 Para el uso de íconos centralizados (`iconName`), ver **[entity-identity.md §8](./entity-identity.md#8-pageheader--integración-con-iconos)**.

| prop | type | required | notes |
|------|------|----------|-------|
| `title` | `string` | ✅ | uses `font-heading` |
| `subtitle` | `string` | ❌ | |
| `breadcrumbs` | `Array<{label; href?}>` | ❌ | |
| `actions` | `ReactNode` | ❌ | Right-aligned |
| `tabs` | `ReactNode` | ❌ | Below title |
| `backHref` | `string` | ❌ | Renders chevron-left |

---

## ActionConfirmModal

> 📄 Ver **[component-modal.md](./component-modal.md)**.

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
| `placeholder` | `string` | ❌ | `'Seleccionar fecha'` | |
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
| `label` | `string` | ❌ | `'Filtrar por fecha'` | Shown when no range selected |
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

## LabeledInput 🟡

> 📄 Documentación completa en **[component-input.md](./component-input.md)**.

Primitivo único para el par label + campo de texto. Reemplaza el patrón deprecated `FORM_STYLES.label + FORM_STYLES.input`.

```tsx
<LabeledInput label="Nombre" required error={fieldState.error?.message} {...field} />
<LabeledInput label="Observaciones" as="textarea" rows={4} {...field} />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | Texto del legend (notched border) |
| `as` | `'input' \| 'textarea'` | ❌ | `'input'` | |
| `required` | `boolean` | ❌ | `false` | Muestra `*` automáticamente |
| `error` | `string` | ❌ | — | Activa estado rojo + `role="alert"` |
| `hint` | `string` | ❌ | — | Texto de ayuda (oculto si hay error) |
| `disabled` | `boolean` | ❌ | `false` | |
| `rows` | `number` | ❌ | `3` | Solo `as="textarea"` |
| `containerClassName` | `string` | ❌ | — | Clases del wrapper `<div>` |

`forwardRef`-compatible. Pasar `{...field}` de react-hook-form directamente. **No usar `<FormLabel>` ni `<FormMessage>`** junto a este componente.

---

## MultiTagInput 🟡

> 📄 Ver **[component-input.md](./component-input.md#multitaginput)**.

Componente para entrada de múltiples etiquetas (tags) con procesamiento mediante la tecla `Enter`.

```tsx
<MultiTagInput label="Valores" values={tags} onAdd={add} onRemove={remove} />
```

---

## MultiSelectTagInput 🟡

> 📄 Ver **[component-input.md](./component-input.md#multiselecttaginput)**.

Selector múltiple con dropdown y etiquetas para opciones predefinidas.

```tsx
<MultiSelectTagInput label="Categorías" options={opts} value={val} onChange={set} />
```

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
| `validationType` | `'tax' \| 'accounting' \| 'both'` | ❌ | `'tax'` | Which periods to check |
| `label` | `string` | ❌ | `'Fecha Emisión'` | |
| `placeholder` | `string` | ❌ | — | |
| `className` | `string` | ❌ | — | |
| `disabled` | `boolean` | ❌ | `false` | |
| `required` | `boolean` | ❌ | `true` | |

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

## QuantityDisplay 🟢

Componente hermano de `MoneyDisplay` exclusivo para cantidades de producción, inventario y medidas físicas (kg, metros, unidades).

```tsx
<QuantityDisplay value={150.5} uom="kg" decimals={2} />
<QuantityDisplay value={diff} showSign />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `value` | `number \| string \| null \| undefined` | ✅ | — | null/undefined/NaN → dash |
| `uom` | `string` | ❌ | — | Suffix for Unit of Measure (e.g. 'kg') |
| `decimals` | `number` | ❌ | `4` | Maximum fraction digits. Standardized to 4 for production precision. |
| `showSign` | `boolean` | ❌ | `false` | Adds `+` prefix for positive values |
| `className` | `string` | ❌ | — | Merged via `cn()` |

Font: always `font-mono tabular-nums`. Do NOT render quantities with raw JS `.toLocaleString()` outside this component if they need to be aligned in tables or forms.

---

## GenericWizard

> 📄 Ver **[component-modal.md](./component-modal.md)**.

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

## AccountingLinesTable 🟢

Tabla estándar para ingreso de líneas de asiento doble (Debe/Haber). Contiene internamente la selección de cuenta contable, glosa, cálculos de balance e interfaz de inserción/borrado de filas. 
Usa `useFieldArray` internamente conectándose a un react-hook-form superior.

```tsx
<AccountingLinesTable control={form.control} name="items" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `control` | `Control<any>` | ✅ | — | Form control de `react-hook-form` |
| `name` | `string` | ✅ | — | Nombre del field array en el schema |

La estructura esperada en el array de form values (zod schema) es un array de objetos con `account`, `label`, `debit`, y `credit`.

States handled: Validaciones de input, cálculo en tiempo real de saldos totales.

> Los inputs internos (`<Input>`) siguen el patrón **Table Cell Input** — ver [component-table-cell-input.md](./component-table-cell-input.md).

---

## FormLineItemsTable 🟢

Shell genérico para tablas de líneas editables (wizards de compra, wizards de producción, notas C/D, distribuciones de capital). Provee el **encabezado + footer con botón "Agregar Línea"** y delega el contenido de las celdas al caller vía `children`.

```tsx
<FormLineItemsTable
  title="Líneas"
  icon={PackageIcon}
  onAdd={() => append({ ... })}
  columns={[
    { header: "Producto", width: "w-[300px]", align: "left" },
    { header: "Cant.",    width: "w-[100px]", align: "center" },
    { header: "P.Unit",  width: "w-[120px]", align: "right" },
    { header: "",         width: "w-[48px]"  },
  ]}
  footer={<BalanceSummary />}
>
  <TableBody>
    {fields.map((field, i) => (
      <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
        <TableCell className="p-2"><ProductSelector ... /></TableCell>
        <TableCell className="p-2"><Input type="number" className="h-8 text-xs font-mono text-right" ... /></TableCell>
      </TableRow>
    ))}
  </TableBody>
</FormLineItemsTable>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `columns` | `FormLineItemColumn[]` | ✅ | — | `{ header, width?, align?, className? }` |
| `children` | `ReactNode` | ✅ | — | Caller renderiza `<TableBody>` completo con sus celdas |
| `onAdd` | `() => void` | ❌ | — | Callback del botón "Agregar Línea" |
| `addButtonText` | `string` | ❌ | `'Agregar Línea'` | |
| `hideAddButton` | `boolean` | ❌ | `false` | Oculta el botón (tablas de solo lectura o read-only wizard steps) |
| `footer` | `ReactNode` | ❌ | — | Slot derecho del footer (balance, totales, etc.) |
| `title` | `string` | ❌ | — | Label sobre la tabla |
| `subtitle` | `string` | ❌ | — | Caption secundario junto al title |
| `icon` | `ElementType` | ❌ | — | Ícono Lucide junto al title |
| `className` | `string` | ❌ | — | |

```typescript
interface FormLineItemColumn {
  header: ReactNode
  width?: string     // e.g. "w-[150px]" o "w-[15%]"
  align?: 'left' | 'center' | 'right'  // default: 'center'
  className?: string
}
```

Import: `import { FormLineItemsTable } from '@/components/shared'`

> Los inputs dentro de las celdas siguen el contrato **[Table Cell Input](./component-table-cell-input.md)**.

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

## Button family (ToolbarCreateButton / ActionButtons)

> 📄 Documentación completa en **[component-button.md](./component-button.md)**.

Catálogo: `SubmitButton` · `CancelButton` · `DangerButton` · `IconButton` · `ToolbarCreateButton`.

---

## PageTabs 🟢

> 📄 Para el uso de `iconName`, ver **[entity-identity.md §3](./entity-identity.md#3-dynamicicon)**.

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

## FormTabs 🟢

Componente de pestañas estandarizado con estética "industrial gráfica" (carpetas troqueladas) para formularios complejos y modales con múltiples secciones. Reemplaza el uso directo de `Tabs` de shadcn/ui.

```tsx
<FormTabs
  items={[
    { value: 'general', label: 'General', icon: InfoIcon, hasErrors: !!errors.name },
    { value: 'pricing', label: 'Precios', icon: DollarSignIcon, disabled: !productId },
  ]}
  value={activeTab}
  onValueChange={setActiveTab}
  orientation="vertical"
  header={<headerSlot />}
>
  <FormTabsContent value="general">...</FormTabsContent>
</FormTabs>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `items` | `FormTabItem[]` | ✅ | — | `{ value, label, icon?, badge?, hasErrors?, hidden?, disabled? }` |
| `value` | `string` | ✅ | — | Controlled state |
| `onValueChange` | `(value: string) => void` | ✅ | — | |
| `orientation` | `'vertical' \| 'horizontal'` | ❌ | `'vertical'` | |
| `variant` | `'folder' \| 'underline'` | ❌ | `'folder'` | `folder`: corte industrial. `underline`: minimalista. |
| `header` | `ReactNode` | ❌ | — | Renderiza sobre el contenido (obligatorio para sticky titles en modales verticales) |
| `footer` | `ReactNode` | ❌ | — | Renderiza debajo del contenido |
| `listClassName` | `string` | ❌ | — | Clases adicionales para el contenedor de pestañas |

### Patrones de Uso

#### 1. Vertical Rail ("Sawtooth")
Estética de riel lateral con efecto de sierra que sobresale del contenedor.
- **Cuándo usar:** Fichas maestras (Producto, Usuario, Contacto), alta densidad de datos (4+ pestañas), modales de gran tamaño (`xl` o superior).
- **Requisito Técnico:** El modal padre DEBE tener `allowOverflow={true}` y `hideScrollArea={true}` para permitir que el riel sobresalga del marco.
- **Navegación:** El título del modal debe moverse al `header` prop de `FormTabs` para alinear el riel con el contenido.

#### 2. Horizontal Group ("Pills")
Estética de mando unificado con doble redondeo superior y base recta.
- **Cuándo usar:** Selectores de vista (Ventas vs Notas C/D), formularios simples o rápidos (2-3 pestañas), componentes inline.
- **Comportamiento:** Se centran automáticamente en su contenedor y actúan como un grupo de botones ("button group") integrado.

---

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

```typescript
// frontend/types/transactions.ts
type TransactionType =
  | 'product'
  | 'contact'
  | 'sale_order'
  | 'purchase_order'
  | 'invoice'
  | 'payment'
  | 'sale_delivery'
  | 'purchase_receipt'
  | 'user'
  | 'company_settings'
  | 'work_order'
  | 'journal_entry'
  | 'stock_move'
  | 'cash_movement'
  | 'sale_return'
  | 'purchase_return'
  | 'inventory'
  | 'profit_distribution'
```

Uses `useTransactionData(type, id)` internally.

Features: print (react-to-print), navigation history between related transactions (`useNavigationHistory`), inline payment editing, delete payment confirmation.

States handled: loading (dual spinner), error, populated.

---

## PageHeaderButton 🟡

Botón estandarizado para usar dentro de las acciones de un `PageHeader`.

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | |
| `icon` | `LucideIcon` | ❌ | — | |
| `onClick` | `() => void` | ❌ | — | |
| `href` | `string` | ❌ | — | Si se provee, renderiza como `<Link>` |
| `disabled` | `boolean` | ❌ | `false` | |
| `variant` | `'default' \| 'outline' \| 'secondary' \| 'ghost'` | ❌ | `'default'` | Variante de Shadcn Button |

---

## ActionFoldButton 🟡

Botón expansible para acciones secundarias.

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | |
| `icon` | `LucideIcon` | ✅ | — | |
| `onClick` | `() => void` | ✅ | — | |
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost'` | ❌ | `'default'` | |

---

## ActionSlideButton 🟢

Botón con animación de deslizamiento para revelar acciones adicionales. Ideal para procesos primarios con alta carga kinética.

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `children` | `ReactNode` | ✅ | — | Texto del botón |
| `icon` | `LucideIcon` | ❌ | — | Icono opcional a la izquierda |
| `variant` | `'primary' \| 'destructive' \| 'success'` | ❌ | `'primary'` | |
| `loading` | `boolean` | ❌ | `false` | Muestra spinner y deshabilita |

---

## LoadingFallback

> 📄 Ver **[component-skeleton.md](./component-skeleton.md)**.

---

## SheetCloseButton 🟢

Universal close primitive for Modals, Sheets, and Panels. Standardizes the 32px circular ghost button pattern.

```tsx
<SheetCloseButton onClick={close} showTooltip tooltipText="Cerrar Panel" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `onClick` | `() => void` | ✅ | — | |
| `className` | `string` | ❌ | — | Merged via `cn()` |
| `label` | `string` | ❌ | `'Cerrar'` | Accessibility label |
| `showTooltip` | `boolean` | ❌ | `false` | |
| `tooltipText` | `string` | ❌ | — | Defaults to `label` |


---

## Componentes Internos 🔴

Componentes de uso estrictamente interno, no consumir directamente en features:

- `ColorBar`: Componente decorativo
- `CropFrame`: Utilidad visual para recorte de imágenes
- `IndustryMark`: Marca de agua de la aplicación

---

## Forbidden usage

- Creating a new badge component instead of using `StatusBadge` (for states) or `Chip` (for labels/tags).
- Inline `<Badge className="text-[8px] ...">` for informational tags — use `<Chip size="xs">`.
- Passing raw Tailwind color classes to any shared component.
- Modifying `/components/ui/` (Shadcn base).
- Calling `.toLocaleString()` for money formatting — use `MoneyDisplay`.
- Rendering currency in tables without `MoneyDisplay` (breaks tabular alignment).
