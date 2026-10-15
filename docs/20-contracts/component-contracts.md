---
layer: 20-contracts
doc: component-contracts
status: active
owner: frontend-team
last_review: 2026-10-14
stability: contract-changes-require-ADR
---

# Component Contracts

Index of all shared components. Sections marked with 📄 have a dedicated contract file — go there for the full prop table, examples, and rules. Sections without a link contain the canonical contract here.

## Legend

- 🟢 Stable — safe to use
- 🟡 Beta — API may still change
- 🔴 Deprecated / removed

> 📄 **Entity prefixes, icons, labels:** [entity-identity.md](./entity-identity.md)

---

## Selectors 🟢

> 📄 [component-selectors.md](./component-selectors.md) — `AccountSelector`, `ProductSelector`, `AdvancedWorkOrderSelector`, and more.

---

## Chips & Status 🟢

> 📄 **Chip** (non-status informational labels) → [component-chip.md](./component-chip.md)

**StatusBadge** — workflow states and record status. Strictly mapped to `STATUS_MAP` in `lib/badge-resolvers.ts`. Only authorized status renderer (GOVERNANCE §19). In DataTable cells render via `DataCell.Status` (tinted badge, ADR-0068).

```tsx
<StatusBadge status="IN_PROGRESS" />
<StatusBadge status="PAID" variant="badge" />
<DataCell.Status status={row.status} />   // table cells — tinted badge
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `status` | `string` | ✅ | — | Business token, case-insensitive; resolved via `resolveStatus()` / `STATUS_MAP` |
| `label` | `string` | ❌ | — | Overrides resolved label |
| `variant` | `'default' \| 'dot' \| 'badge' \| 'hub'` | ❌ | `'default'` | `default`/`dot` = compact (cards, kanban); `badge` = square tinted (drawers, detail); `hub` = circular icon |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | ❌ | `'md'` | sm=h-6/12px (tables), md=h-8/14px (modals), lg=h-10/base (detail) |
| `className` | `string` | ❌ | — | Layout/position only — never typography or colors |

---

## Modals & Sheets

> 📄 **BaseModal / ActionConfirmModal / GenericWizard** → [component-modal.md](./component-modal.md)

**CollapsibleSheet** 🟢 — Side panel with collapsible tab. Supports multi-sheet stacking via `GlobalModalProvider`.

```tsx
<CollapsibleSheet sheetId="order-detail" open={open} onOpenChange={setOpen}
  tabLabel="Detalle" tabIcon={FileTextIcon} size="lg">
  <OrderDetail id={id} />
</CollapsibleSheet>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `children` | `ReactNode` | ✅ | — | |
| `sheetId` | `string` | ✅ | — | Unique ID for stacking z-index |
| `open` | `boolean` | ✅ | — | |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | |
| `tabLabel` | `string` | ✅ | — | Vertical tab text when collapsed |
| `tabIcon` | `LucideIcon` | ✅ | — | |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | ❌ | `'md'` | sm=442px, md=682px, lg=882px, xl=1082px, full=100vw |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right'` | ❌ | `'right'` | |
| `forceCollapse` | `boolean` | ❌ | `false` | Keep tab visible even when open |
| `fullWidth` | `number` | ❌ | — | Override size with px value |
| `hideOverlay` | `boolean` | ❌ | `false` | |
| `pushOffset` | `number` | ❌ | — | Pixel offset for stacking |

Requires `GlobalModalProvider` in layout. DOM unmounts 500ms after close for exit animation.

### Surface textures

POS panels and industrial surfaces use background textures from `@utility` (defined in `app/globals.css`):

| Utility | When to use |
|---------|-------------|
| `dot-grid-surface` | POS cart, product grid panels (24px grid) |
| `dot-grid-surface-sm` | Compact panels (12px grid) |
| `cross-grid-surface` | Technical/engineering surfaces |
| `ribbon-cmyk` | CMY gradient top border on cards |
| `card-focus-spin-cmyk` | CMY gradient border on hover/focus (included in `card-base`) |

Apply only to `bg-card` surfaces. Do not combine two textures. Do not apply to overlays.

---

## Tables & Data Display

> 📄 **DataTable & ExpandableTableRow** → [component-datatable-views.md](./component-datatable-views.md)
> 📄 **Row & Card Actions** → [component-row-actions.md](./component-row-actions.md)
> 📄 **Table Cell Input** (excepción de input dentro de `<TableCell>`) → [component-table-cell-input.md](./component-table-cell-input.md)

### DataCell primitives 🟢

> Import: `import { DataCell, createActionsColumn } from '@/components/shared'`
> **Para campos de entidad**, declarar `FieldDef.type` en `*Fields.ts` — ver [component-fields.md](./component-fields.md).
> Los primitivos aquí se usan directamente solo en renderers `computed` y columnas de excepción.

**Clasificación de textos:**
- `DataCell.Text` — texto primario por defecto (`text-xs font-medium`)
- `DataCell.Secondary` — dato complementario (`text-xs font-medium text-muted-foreground`)

**DataCell.Date** (ADR-0062):

| prop | type | required | default |
|------|------|----------|---------|
| `value` | `string \| Date` | ✅ | — |
| `showTime` | `boolean` | ❌ | `false` |
| `dateWeight` | `DataCellWeight` | ❌ | `'medium'` |
| `timeWeight` | `DataCellWeight` | ❌ | `'normal'` |

Pesos (`DataCellWeight`): `light` · `normal` · `medium` · `semibold` · `bold`. Zona `header` aplica `semibold` automático vía entity-fields.

**DataCell.Entity / DataCell.Link / DataCell.ContactLink:**

| Primitivo | Cuándo usar |
|---|---|
| `DataCell.Entity` | Documento de negocio del ERP (OV, OT, Factura, Producto) |
| `DataCell.Link` | URL genérica o callback (no registral) |
| `DataCell.ContactLink` | Nombre de persona/empresa → abre `ContactDrawer` |

**DataCell.NumericFlow** — cantidades con polaridad (+/−). Badge `rounded-sm` tintado. Props: `value`, `unit?`, `showSign?` (default `true`).

**DataCell.Progress** — barra de completitud. Props: `value`, `max?` (default 100), `label?`, `subLabel?`.

**DataCell.Category** (ADR-0066) — chips resueltos por dominio (`contact_type`, `product_type`, etc.). Props: `value`, `domain?`, `size?`.

### createExpanderColumn 🟢

Factory para columna de expansión en `DataTable`. `canExpand?: (row: TData) => boolean` oculta el botón en filas no-expandibles.

### AccountingLinesTable 🟢

Tabla de líneas de asiento doble (Debe/Haber) conectada a `react-hook-form`.

```tsx
<AccountingLinesTable control={form.control} name="items" />
```

Props: `control` (✅), `name` (✅). Los inputs internos siguen el contrato [Table Cell Input](./component-table-cell-input.md).

### FormLineItemsTable 🟢

Shell genérico para tablas de líneas editables (wizards, notas C/D). Provee encabezado + footer "Agregar Línea", el caller renderiza el `<TableBody>`.

```tsx
<FormLineItemsTable title="Líneas" icon={PackageIcon} onAdd={() => append({...})}
  columns={[{ header: "Producto", width: "w-[300px]", align: "left" }, ...]}
  footer={<BalanceSummary />}>
  <TableBody>...</TableBody>
</FormLineItemsTable>
```

| prop | type | required | default |
|------|------|----------|---------|
| `columns` | `FormLineItemColumn[]` | ✅ | — |
| `children` | `ReactNode` | ✅ | — |
| `onAdd` | `() => void` | ❌ | — |
| `addButtonText` | `string` | ❌ | `'Agregar Línea'` |
| `hideAddButton` | `boolean` | ❌ | `false` |
| `footer` | `ReactNode` | ❌ | — |
| `title` | `string` | ❌ | — |
| `icon` | `ElementType` | ❌ | — |

> **vs `DataTable variant="minimal"`:** `FormLineItemsTable` es para edición; `minimal` es para display.

### ReportTable 🟢

Tabla jerárquica de reportes contables con expand/collapse y períodos de comparación.

| prop | type | required | default |
|------|------|----------|---------|
| `data` | `ReportNode[] \| null` | ✅ | — |
| `showComparison` | `boolean` | ❌ | `false` |
| `isLoading` | `boolean` | ❌ | `false` |
| `accentColor` | `'primary' \| 'success' \| 'info' \| 'destructive' \| 'income' \| 'expense' \| 'asset' \| 'liability'` | ❌ | `'primary'` |
| `varianceDirection` | `'higher-is-better' \| 'lower-is-better'` | ❌ | `'higher-is-better'` |

`ReportNode`: `{ id, code, name, balance, comp_balance?, variance?, children? }`.

### BudgetVarianceTable 🟢 (feature-local)

Tabla de varianza presupuestaria. En `features/finance/components/` — no exportada desde shared.

Props: `data: BudgetVarianceNode[]` (✅), `loading?: boolean`.

---

## Money & Quantities

### MoneyDisplay 🟢

Fuente única de verdad para renderizado de dinero. No usar `.toLocaleString()` para montos.

```tsx
<MoneyDisplay amount={150000} />
<MoneyDisplay amount={null} showZeroAsDash />
```

| prop | type | required | default |
|------|------|----------|---------|
| `amount` | `number \| string \| null \| undefined` | ✅ | — |
| `currency` | `string` | ❌ | `'CLP'` |
| `showColor` | `boolean` | ❌ | `true` |
| `showZeroAsDash` | `boolean` | ❌ | `false` |
| `digits` | `number` | ❌ | `0` |
| `weight` | `DataCellWeight` | ❌ | `'medium'` |

### QuantityDisplay 🟢

Para cantidades de producción/inventario (kg, metros, unidades). Font `font-mono tabular-nums`.

Props: `value` (✅), `uom?`, `decimals?` (default 4), `showSign?`.

---

## Inputs & Forms

> 📄 **LabeledInput / MultiTagInput / MultiSelectTagInput** → [component-input.md](./component-input.md)
> 📄 **DatePicker / DateRangeFilter** → [component-datepicker.md](./component-datepicker.md)

### Dropdown & Popover Layout Invariants

Rules for positioning and width of floating UI elements.

**Width invariant:** every dropdown within a form field (Select, Selector, Combobox) MUST match trigger width via `w-[var(--radix-select-trigger-width)]` or `w-[var(--radix-popover-trigger-width)]`. Exception: filters in toolbars and `DateRangeFilter`.

**Positioning vs. notched fields:**
- Standard `LabeledSelect` → `item-aligned` (covers trigger)
- Feature-rich selectors (`AccountSelector`, `ProductSelector`) → `popper` (aligns to bottom border to avoid obscuring search input)

### FolioValidationInput 🟢

Text input with real-time DTE folio uniqueness validation.

| prop | type | required | default |
|------|------|----------|---------|
| `value` | `string` | ✅ | — |
| `onChange` | `(value: string) => void` | ✅ | — |
| `dteType` | `string` | ✅ | — |
| `contactId` | `number` | ❌ | — |
| `isPurchase` | `boolean` | ❌ | `false` |
| `excludeId` | `number` | ❌ | — |
| `onValidityChange` | `(isValid: boolean, result: FolioValidationResult \| null) => void` | ❌ | — |

States: validating (spinner), valid (check), duplicate (warning + alert).

### PeriodValidationDateInput 🟢

DatePicker que valida cierre de períodos fiscal/contable antes de aceptar una fecha.

| prop | type | required | default |
|------|------|----------|---------|
| `date` | `Date \| undefined` | ✅ | — |
| `onDateChange` | `(date: Date \| undefined) => void` | ✅ | — |
| `validationType` | `'tax' \| 'accounting' \| 'both'` | ❌ | `'tax'` |
| `onValidityChange` | `(isValid: boolean) => void` | ❌ | — |

States: validating (spinner), period closed (warning alert, `isValid=false`).

### DataManagement 🟢

Toolbar group: export CSV, download template, import CSV.

```tsx
<DataManagement onExport={handleExport} onImport={handleImport}
  templateData={[{ nombre: '', rut: '' }]} onImportSuccess={refetch}
  exportFilename="productos" />
```

Props: `onExport` (✅), `onImport` (✅), `templateData` (✅), `onImportSuccess` (✅), `exportFilename?`.

### DocumentAttachmentDropzone 🟢

Drag-and-drop file input con lógica DTE-aware de campo requerido.

| prop | type | required | default |
|------|------|----------|---------|
| `file` | `File \| null` | ✅ | — |
| `onFileChange` | `(file: File \| null) => void` | ✅ | — |
| `dteType` | `string` | ❌ | — |
| `isPending` | `boolean` | ❌ | `false` |
| `accept` | `string` | ❌ | `'.pdf,.xml,image/*'` |

### DocumentCompletionModal 🟢

Modal para completar una factura (folio, fecha, adjunto). Valida períodos antes de submit.

Props: `open`, `onOpenChange`, `invoiceId`, `invoiceType`, `onComplete`, `onSuccess?`, `contactId?`, `isPurchase?`.

### FacetedFilter 🟢

Multi-select popover para filtros de columna en tablas.

Props: `title?`, `options: Array<{label, value, icon?}>` (✅), `selectedValues: string[]` (✅), `onSelect` (✅).

---

## Navigation & Layout

> 📄 **Section headers** → [component-section-header.md](./component-section-header.md)

### PageHeader 🟢

> 📄 Para `iconName` centralizado → [entity-identity.md §8](./entity-identity.md#8-pageheader--integración-con-iconos)

| prop | type | required |
|------|------|----------|
| `title` | `string` | ✅ |
| `subtitle` | `string` | ❌ |
| `breadcrumbs` | `Array<{label; href?}>` | ❌ |
| `actions` | `ReactNode` | ❌ |
| `tabs` | `ReactNode` | ❌ |
| `backHref` | `string` | ❌ |

### PageTabs 🟢

Industrial underline navigation tabs with optional subtab dropdowns.

```tsx
<PageTabs tabs={[{ value: 'orders', label: 'Órdenes', iconName: 'ClipboardList', href: '/sales' }]}
  activeValue="orders" />
```

Tab config: `{ value, label, iconName, href, subTabs? }`. Props: `tabs` (✅), `activeValue` (✅), `subActiveValue?`, `variant?: 'default' | 'minimal'`, `configHref?`.

### TabBar 🟢

Pestañas con estética "carpetas troqueladas" para formularios complejos.

```tsx
<TabBar items={[{ value: 'general', label: 'General', icon: InfoIcon }]}
  value={activeTab} onValueChange={setActiveTab} orientation="vertical">
  <TabBarContent value="general">...</TabBarContent>
</TabBar>
```

Props: `items: FormTabItem[]` (✅), `value` (✅), `onValueChange` (✅), `orientation?: 'vertical' | 'horizontal'`, `variant?: 'folder' | 'underline'`, `header?`, `footer?`.

**Vertical rail ("Sawtooth"):** fichas maestras (4+ tabs, modal `xl+`). El modal padre DEBE tener `allowOverflow={true}` y `hideScrollArea={true}`.

**Horizontal group ("Pills"):** selectores de vista (2-3 tabs, componentes inline).

---

## Buttons

> 📄 [component-button.md](./component-button.md) — `SubmitButton`, `CancelButton`, `DangerButton`, `IconButton`, `ToolbarCreateButton`, `ActionSlideButton`.

**PageHeaderButton** 🟡 — botón estándar para `PageHeader.actions`.

Props: `label` (✅), `icon?`, `onClick?`, `href?`, `disabled?`, `variant?: 'default' | 'outline' | 'secondary' | 'ghost'`.

**ActionFoldButton** 🟡 — botón expansible para acciones secundarias.

Props: `label` (✅), `icon` (✅), `onClick` (✅), `variant?`.

**ActionDock** 🟡 — floating taskbar for multi-selection actions.

```tsx
<ActionDock isVisible={selectedIds.length > 0}>
  <ActionDock.Stats>
    <ActionDock.Stat label="Seleccionados" value={selectedIds.length} />
  </ActionDock.Stats>
  <ActionDock.Actions>
    <Button onClick={handleBatch}>Procesar</Button>
  </ActionDock.Actions>
</ActionDock>
```

Props: `isVisible: boolean` (✅). Sub-components: `ActionDock.Stats`, `ActionDock.Stat` (`label`, `value`, `colorClass?`), `ActionDock.Actions`, `ActionDock.Section`.

---

## Feedback & Utility

> 📄 **Skeleton family / LoadingFallback** → [component-skeleton.md](./component-skeleton.md)

### EmptyState 🟢

```tsx
<EmptyState icon={<PackageIcon />} title="Sin órdenes" action={<Button>Crear</Button>}
  variant="full" context="inventory" />
```

| prop | type | required | default |
|------|------|----------|---------|
| `context` | `'search' \| 'inventory' \| 'finance' \| 'users' \| 'generic' \| 'database' \| 'production' \| 'pos' \| 'bom' \| 'treasury' \| 'sale' \| 'purchase'` | ❌ | `'generic'` |
| `variant` | `'full' \| 'compact' \| 'minimal'` | ❌ | `'full'` |
| `title` / `description` / `icon` / `action` / `secondaryAction` | various | ❌ | — |

### CommentSystem 🟢

Thread de comentarios con feed scrollable. `Enter` = submit, `Shift+Enter` = newline.

Props: `comments: Comment[]` (✅), `onAddComment` (✅), `placeholder?`, `maxHeight?` (default `'400px'`).

`Comment`: `{ user: string, text: string, timestamp: string }`.

### AttachmentList 🟢

Grid de adjuntos con descarga y delete opcional.

Props: `attachments: Attachment[]` (✅), `onDelete?: (id: number) => void`, `isDeleting?: number | null`.

`Attachment`: `{ id, file, original_filename, file_size_formatted, uploaded_at, user_name?, mime_type? }`.

### SheetCloseButton 🟢

Botón de cierre universal (32px circular ghost) para Modals, Sheets y Panels.

Props: `onClick` (✅), `label?` (default `'Cerrar'`), `showTooltip?`, `tooltipText?`.

---

## Deprecated 🔴

**TransactionViewModal** — eliminado (ADR-0028). Reemplazado por `ENTITY_DRAWERS` + `openEntity`. Ver [component-entity-drawers.md](./component-entity-drawers.md).

**Componentes internos** (no consumir en features): `ColorBar` (decorativo).

---

## Forbidden usage

- Nuevo badge component en lugar de `StatusBadge` (estados) o `Chip` (labels/tags).
- `<Badge className="text-[8px] ...">` inline — usar `<Chip size="xs">`.
- Import directo de `@/components/ui/badge` en features — usar `Badge`/`Chip`/`StatusBadge` desde `@/components/shared`.
- Raw Tailwind color classes en cualquier shared component.
- Modificar `/components/ui/` (Shadcn base).
- `.toLocaleString()` para montos — usar `MoneyDisplay`.
- Renderizar moneda en tablas sin `MoneyDisplay` (rompe alineación tabular).
