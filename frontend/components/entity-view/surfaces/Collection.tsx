"use client"

import * as React from "react"
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, LayoutGrid, Rows3 } from "lucide-react"
import { DataTablePagination, EmptyState, EntityCard } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { getEntityIcon } from "@/lib/entity-registry"
import { cn } from "@/lib/utils"
import {
    alignOf,
    entityName,
    fieldById,
    readValue,
    resolveField,
    resolveOptions,
    type CardLayout,
    type CardSection,
    type CardTone,
    type Entity,
    type EntityIdentity,
    type EntitySpec,
    type FieldDef,
    type FieldMap,
    type TableLayout,
} from "../core/define-entity"
import { toNumber } from "../core/formatters"
import { getValueKind, type Align, type Surface, type ValueKind } from "../core/value-kinds"
import type { EntityCollection } from "../core/use-entity-collection"
import { ALIGN_FLEX, ALIGN_TEXT } from "../core/align"
import { useEntityOpener } from "./EntityViewProvider"

// ─── Context ─────────────────────────────────────────────────────────────────

export type CollectionViewMode = "table" | "card"
export type SelectionMode = "none" | "bulk" | "panel"

/** What the surfaces read from the entity: label and fields (the literal field-id map `F` is erased). */
type EntityRef<T> = EntityIdentity & Pick<EntitySpec<T, FieldMap<T>>, "fields" | "export">

interface CollectionContextValue<T> {
    collection: Omit<EntityCollection<T, FieldMap<T>>, "entity"> & { entity: EntityRef<T> }
    actions?: (row: T) => React.ReactNode
    open: (row: T) => void
    canOpen: boolean
    selection: SelectionMode
    selectedId?: string | null
    view: CollectionViewMode
    setView: (view: CollectionViewMode) => void
    label: string
}

/**
 * One context serves every row type, so it is stored as `unknown` (providing a typed value needs no
 * cast). Reading it back as `T` is the single bridge (R7): `Collection.*` children only render inside
 * the `Root` that provided that same `T`.
 */
const CollectionContext = React.createContext<unknown>(null)

function useCollectionContext<T>(): CollectionContextValue<T> {
    const ctx = React.useContext(CollectionContext)
    if (ctx === null) throw new Error("entity-view: Collection.* debe usarse dentro de <Collection.Root>")
    return ctx as CollectionContextValue<T>
}

// ─── Field rendering ─────────────────────────────────────────────────────────

export function FieldValue<T>({ def, row, surface, align }: { def: FieldDef<T, ValueKind>; row: T; surface: Surface; align?: Align }) {
    const spec = getValueKind(def.kind)
    const Render = spec.render
    return <Render value={readValue(def, row)} options={resolveOptions(def, row)} surface={surface} align={align ?? alignOf(def)} label={def.label} />
}

/** Cell padding from the density tokens (compact/comfortable, track B). */
export const CELL = "px-(--table-cell-px) py-(--table-cell-py)"
/** Canonical header text (DataTableColumnHeader `headerTextClass`, track B). */
export const HEADER_TEXT = "text-3xs font-bold uppercase tracking-widest text-muted-foreground"

// ─── Root ────────────────────────────────────────────────────────────────────

export interface CollectionRootProps<T, F extends FieldMap<T>> {
    collection: EntityCollection<T, F>
    children: React.ReactNode
    /** Row actions (e.g. `uomActions.render(row, ctx)`); rendered outside the clickable area (AX-4). */
    actions?: (row: T) => React.ReactNode
    /** Overrides the default opener (EntityViewProvider → drawer registry by entity label). */
    onOpen?: (row: T) => void
    selection?: SelectionMode
    /** Highlighted row in `panel` selection mode (document sheet open). */
    selectedId?: string | number | null
    defaultView?: CollectionViewMode
    /** Controlled view, e.g. from `useCollectionViewMode` (`?view=` in the URL). Uncontrolled when omitted. */
    view?: CollectionViewMode
    onViewChange?: (view: CollectionViewMode) => void
    /** Accessible name. Defaults to the entity label resolved by the provider. */
    label?: string
}

function Root<T, F extends FieldMap<T>>({ collection, children, actions, onOpen, selection = "none", selectedId, defaultView = "table", view: controlledView, onViewChange, label }: CollectionRootProps<T, F>) {
    const opener = useEntityOpener()
    const [localView, setLocalView] = React.useState<CollectionViewMode>(defaultView)
    const view = controlledView ?? localView
    const setView = React.useCallback(
        (next: CollectionViewMode) => {
            if (controlledView === undefined) setLocalView(next)
            onViewChange?.(next)
        },
        [controlledView, onViewChange],
    )
    const entity = collection.entity
    const open = React.useCallback(
        (row: T) => {
            if (onOpen) return onOpen(row)
            const id = Number((row as { id?: unknown }).id)
            if (opener && entity.label && Number.isFinite(id)) opener.open(entity.label, id, row)
        },
        [onOpen, opener, entity.label],
    )
    const value: CollectionContextValue<T> = {
        collection,
        actions,
        open,
        // Embedded rows (no registry label) only open through an explicit `onOpen`.
        canOpen: !!onOpen || (!!opener && !!entity.label),
        selection,
        selectedId: selectedId === undefined || selectedId === null ? null : String(selectedId),
        view,
        setView,
        label: label ?? (entity.label !== undefined ? opener?.labelOf(entity.label) : undefined) ?? entityName(entity),
    }
    return (
        <CollectionContext.Provider value={value}>
            <div className="flex flex-col gap-2 min-h-0">{children}</div>
        </CollectionContext.Provider>
    )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

export interface CollectionToolbarProps {
    /** Search/filters slot (e.g. UnifiedSearchBar) and the create action. */
    children?: React.ReactNode
    views?: readonly CollectionViewMode[]
    /** Current filters, forwarded to the entity export hook (export-formats.md). */
    exportFilters?: Record<string, unknown>
}

const VIEW_BUTTONS = {
    table: { icon: Rows3, label: "Vista tabla" },
    card: { icon: LayoutGrid, label: "Vista tarjetas" },
} as const

function Toolbar({ children, views = ["table", "card"], exportFilters = {} }: CollectionToolbarProps) {
    const ctx = useCollectionContext<unknown>()
    const exportSpec = ctx.collection.entity.export
    const selectedCount = ctx.collection.table.getSelectedRowModel().rows.length
    return (
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={`Herramientas de ${ctx.label}`}>
            <div className="flex-1 min-w-0">{children}</div>
            {selectedCount > 0 && (
                <span className="text-xs text-muted-foreground" aria-live="polite">{selectedCount} seleccionados</span>
            )}
            {exportSpec && <ExportButtons spec={exportSpec} filters={exportFilters} />}
            {views.length > 1 && (
                <div className="flex items-center gap-1" role="group" aria-label="Vista">
                    {views.map((mode) => {
                        const { icon: Icon, label: viewLabel } = VIEW_BUTTONS[mode]
                        return (
                            <Button key={mode} variant={ctx.view === mode ? "secondary" : "ghost"} size="icon" aria-label={viewLabel} aria-pressed={ctx.view === mode} onClick={() => ctx.setView(mode)}>
                                <Icon className="size-4" aria-hidden />
                            </Button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/** Separate component so the feature export hook is always called unconditionally. */
function ExportButtons({ spec, filters }: { spec: NonNullable<Entity<unknown, FieldMap<unknown>>["export"]>; filters: Record<string, unknown> }) {
    const { run, isPending } = spec.useExport()
    return (
        <div className="flex items-center gap-1" role="group" aria-label="Exportar">
            {spec.formats.map((format) => (
                <Button key={format} variant="outline" size="sm" disabled={isPending} onClick={() => run(format, filters)}>
                    {format.toUpperCase()}
                </Button>
            ))}
        </div>
    )
}

// ─── View (switch + states) ──────────────────────────────────────────────────

export interface CollectionViewProps<T, Id extends string> {
    table?: TableLayout<Id>
    card?: CardLayout<T, Id>
    emptyTitle?: string
    emptyDescription?: string
}

function View<T, Id extends string>({ table, card, emptyTitle, emptyDescription }: CollectionViewProps<T, Id>) {
    const ctx = useCollectionContext<T>()
    const { status } = ctx.collection
    if (status === "error" || status === "empty") {
        return <CollectionMessage status={status} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
    }
    if (ctx.view === "card" && card) return <Grid layout={card} />
    if (table) return <TableSurface layout={table} />
    return null
}

/**
 * Error and empty states keep the collection frame (no layout jump) and offer a way out:
 * retry on error, operational copy instead of raw server messages, filtered vs truly empty.
 */
function CollectionMessage({ status, emptyTitle, emptyDescription }: { status: "error" | "empty"; emptyTitle?: string; emptyDescription?: string }) {
    const ctx = useCollectionContext<unknown>()
    const { refetch, isFiltered, entity } = ctx.collection
    const noun = ctx.label.toLowerCase()
    return (
        <div className="rounded-md border">
            {status === "error" ? (
                <EmptyState
                    icon={AlertTriangle}
                    context="generic"
                    title={`No pudimos cargar ${noun}`}
                    description="Revisa tu conexión e intenta nuevamente."
                    variant="compact"
                    action={refetch ? <Button variant="outline" size="sm" onClick={refetch}>Reintentar</Button> : undefined}
                />
            ) : isFiltered ? (
                <EmptyState context="search" title="Ningún resultado para el filtro" description="Prueba con otros términos o limpia los filtros." variant="compact" />
            ) : (
                <EmptyState entityLabel={entity.label} title={emptyTitle} description={emptyDescription} variant="compact" />
            )}
        </div>
    )
}

// ─── Table ───────────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
    if (dir === "asc") return <ArrowUp className="size-3 text-primary" aria-hidden />
    if (dir === "desc") return <ArrowDown className="size-3 text-primary" aria-hidden />
    return <ArrowUpDown className="size-3 opacity-30" aria-hidden />
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const

function TableSurface<T, Id extends string>({ layout }: { layout: TableLayout<Id> }) {
    const ctx = useCollectionContext<T>()
    const { table, status, isRefetching, total } = ctx.collection
    const entity = ctx.collection.entity
    const primary = layout.primary ?? layout.columns[0]
    const rows = table.getRowModel().rows
    const isBulk = ctx.selection === "bulk"
    const hasActions = !!ctx.actions
    const sums = layout.footer?.sum ?? []
    // Columns resolved once and shared by header, skeleton, body and footer.
    const cols = React.useMemo(
        () => layout.columns.map((id) => {
            const def = fieldById(entity, id)
            return { id, def, align: alignOf(def) }
        }),
        [layout.columns, entity],
    )
    const originals = rows.map((r) => r.original)

    return (
        <div className="flex flex-col min-h-0 overflow-hidden rounded-md border">
            <div className="relative overflow-auto max-h-[calc(100vh-260px)]">
                <table
                    className="w-full text-sm"
                    data-density="compact"
                    aria-label={ctx.label}
                    aria-busy={status === "loading" || isRefetching}
                    aria-rowcount={total + 1}
                >
                    <thead className="sticky top-0 z-10 bg-background">
                        <tr className="border-b">
                            {isBulk && (
                                <th scope="col" className="w-8 px-(--table-header-px) py-(--table-header-py)">
                                    <Checkbox
                                        aria-label="Seleccionar todas las filas visibles"
                                        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                                        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                                    />
                                </th>
                            )}
                            {cols.map(({ id, def, align }) => {
                                const column = table.getColumn(id)
                                const dir = column?.getIsSorted() ?? false
                                return (
                                    <th
                                        key={id}
                                        scope="col"
                                        aria-sort={dir ? ARIA_SORT[dir] : undefined}
                                        className={cn("h-(--table-header-h) px-(--table-header-px) py-(--table-header-py) whitespace-nowrap", HEADER_TEXT, ALIGN_TEXT[align])}
                                    >
                                        {column?.getCanSort() ? (
                                            // Compact header height; the Fitts guard is lifted by `data-density="compact"` (R3).
                                            <Button variant="ghost" size="sm" className={cn("-mx-2 h-7 gap-1", align === "end" && "flex-row-reverse")} onClick={column.getToggleSortingHandler()}>
                                                {/* Same header text treatment as DataTableColumnHeader (canonical header, track B). */}
                                                <span className={HEADER_TEXT}>{def.header ?? def.label}</span>
                                                <SortIcon dir={dir} />
                                            </Button>
                                        ) : (
                                            def.header ?? def.label
                                        )}
                                    </th>
                                )
                            })}
                            {hasActions && <th scope="col" className="w-px"><span className="sr-only">Acciones</span></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {status === "loading"
                            ? Array.from({ length: 8 }, (_, i) => (
                                // Same row height and column alignment as real rows (component-skeleton, no CLS).
                                <tr key={i} className="border-b border-border/40">
                                    {isBulk && <td className={cn("w-8", CELL)} />}
                                    {cols.map(({ id, align }) => (
                                        <td key={id} className={CELL}>
                                            <div className={cn("flex h-7 items-center", ALIGN_FLEX[align])}>
                                                <Skeleton className={cn("h-3", align === "end" ? "w-16" : "w-24")} />
                                            </div>
                                        </td>
                                    ))}
                                    {hasActions && <td />}
                                </tr>
                            ))
                            : rows.map((row, index) => {
                                const isSelected = ctx.selectedId === row.id || row.getIsSelected()
                                return (
                                    <tr
                                        key={row.id}
                                        aria-rowindex={table.getState().pagination.pageIndex * table.getState().pagination.pageSize + index + 2}
                                        aria-selected={ctx.selection !== "none" ? isSelected : undefined}
                                        className={cn("group border-b border-border/40 table-row-hover transition-colors", ctx.canOpen && "cursor-pointer", isSelected && "bg-primary/5")}
                                        // Mouse enhancement only: the keyboard path is the primary cell button (AX-3).
                                        onClick={() => ctx.canOpen && ctx.open(row.original)}
                                    >
                                        {isBulk && (
                                            <td className={CELL} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox aria-label="Seleccionar fila" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
                                            </td>
                                        )}
                                        {cols.map(({ id, def, align }) => (
                                            <td key={id} className={cn(CELL, "align-middle whitespace-nowrap", ALIGN_TEXT[align])}>
                                                {id === primary && ctx.canOpen ? (
                                                    <PrimaryCell def={def} row={row.original} onOpen={ctx.open} align={align} />
                                                ) : (
                                                    <FieldValue def={def} row={row.original} surface="table" align={align} />
                                                )}
                                            </td>
                                        ))}
                                        {hasActions && (
                                            <td className={cn(CELL, "text-right")} onClick={(e) => e.stopPropagation()}>
                                                {ctx.actions?.(row.original)}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                    </tbody>
                    {sums.length > 0 && status === "ready" && (
                        <tfoot className="border-t bg-muted/30">
                            <tr>
                                {isBulk && <td />}
                                {cols.map(({ id, def, align }, i) =>
                                    sums.includes(id) ? (
                                        <td key={id} className={cn(CELL, "text-xs font-semibold tabular-nums", ALIGN_TEXT[align])}>
                                            {formatSum(def, originals)}
                                        </td>
                                    ) : (
                                        <td key={id} className={cn(CELL, HEADER_TEXT)}>{i === 0 ? "Total" : null}</td>
                                    ),
                                )}
                                {hasActions && <td />}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            {ctx.collection.paginated && status !== "loading" && (
                <div className="px-1.5 py-1">
                    <DataTablePagination table={table} />
                </div>
            )}
        </div>
    )
}

/**
 * The row's default action (AX-3). Kinds with an inline renderer keep their own look inside the
 * button (R1: DataCell renders a `span`); other kinds fall back to their formatted text.
 */
function PrimaryCell<T>({ def, row, onOpen, align }: { def: FieldDef<T, ValueKind>; row: T; onOpen: (row: T) => void; align: Align }) {
    const { value, options, text } = resolveField(def, row)
    const Inline = getValueKind(def.kind).inline
    return (
        // Natural height: the table's `data-density="compact"` lifts the Fitts guard on fine pointers (R3).
        <Button
            variant="link"
            className="h-auto p-0 text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline"
            onClick={(e) => {
                e.stopPropagation()
                onOpen(row)
            }}
        >
            {Inline ? (
                <Inline value={value} options={options} surface="table" align={align} label={def.label} />
            ) : (
                text
            )}
        </Button>
    )
}

/**
 * Footer total formatted with the kind's own formatter (same output as the cells).
 * Rows are grouped by their resolved options (unit, currency): adding 600 sheets and
 * 5 thousand-packs is meaningless, so mixed units render as "600 Hoja · 5 Millar".
 */
export function formatSum<T>(def: FieldDef<T, ValueKind>, rows: readonly T[]): string {
    if (rows.length === 0) return "—"
    const spec = getValueKind(def.kind)
    const groups = new Map<string, { total: number; options: ReturnType<typeof resolveOptions<T, ValueKind>> }>()
    for (const row of rows) {
        const options = resolveOptions(def, row)
        const key = JSON.stringify(options)
        const group = groups.get(key) ?? { total: 0, options }
        group.total += toNumber(readValue(def, row) as number | string | null | undefined) ?? 0
        groups.set(key, group)
    }
    return [...groups.values()].map((g) => spec.format(g.total, g.options)).join(" · ")
}

// ─── Card grid ───────────────────────────────────────────────────────────────

const TONE_CLASS: Record<CardTone, string> = {
    default: "text-muted-foreground bg-muted/40",
    primary: "text-primary bg-primary/10",
    info: "text-info bg-info/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    muted: "text-muted-foreground/60 bg-muted/30",
}

function pick<T, V>(value: V | ((row: T) => V) | undefined, row: T): V | undefined {
    return typeof value === "function" ? (value as (r: T) => V)(row) : value
}

const GRID_CLASS = "grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(3,minmax(0,1fr))]"

function Grid<T, Id extends string>({ layout }: { layout: CardLayout<T, Id> }) {
    const ctx = useCollectionContext<T>()
    const { table, status } = ctx.collection
    const entity = ctx.collection.entity
    const isBulk = ctx.selection === "bulk"
    // Meta field definitions are resolved once per layout, not per card.
    const metaDefs = React.useMemo(() => (layout.meta ?? []).map((id) => ({ id, def: fieldById(entity, id) })), [layout.meta, entity])

    if (status === "loading") {
        return (
            <ul className={GRID_CLASS} aria-busy>
                {Array.from({ length: 6 }, (_, i) => (
                    <li key={i}><EntityCard.Skeleton /></li>
                ))}
            </ul>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            <ul className={GRID_CLASS} aria-label={ctx.label}>
                {table.getRowModel().rows.map((row) => {
                    const data = row.original
                    const media = layout.media
                    const Avatar = media?.avatar
                    const icon = media?.iconFor?.(data) ?? media?.icon ?? (entity.label !== undefined ? getEntityIcon(entity.label) : undefined)
                    const tone = pick(media?.tone, data) ?? "default"
                    const subtitle = (layout.subtitle ?? [])
                        .map((id) => resolveField(fieldById(entity, id), data).text)
                        .filter((t) => t && t !== "—")
                        .join(" · ")
                    const title = resolveField(fieldById(entity, layout.title), data).text
                    const trailing = layout.trailing && layout.trailing.length > 0
                        ? layout.trailing.map((id) => <FieldValue key={id} def={fieldById(entity, id)} row={data} surface="card" align="start" />)
                        : null
                    return (
                        <li key={row.id} className="@container min-w-0">
                            <EntityCard
                                variant="compact"
                                isSelected={ctx.selectedId === row.id}
                                selectable={isBulk}
                                checked={row.getIsSelected()}
                                onCheckedChange={(v) => row.toggleSelected(v)}
                                // Always visible in bulk mode: EntityCard reveals it on hover otherwise, and touch has no hover.
                                isAnySelected
                                selectionLabel={`Seleccionar ${title}`}
                            >
                                <EntityCard.Header
                                    icon={icon}
                                    iconClassName={TONE_CLASS[tone]}
                                    imageSrc={media?.image?.(data) ?? undefined}
                                    avatar={Avatar ? <Avatar row={data} /> : undefined}
                                    title={
                                        ctx.canOpen ? (
                                            <Button variant="link" className="h-7 p-0 text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:underline" onClick={() => ctx.open(data)}>
                                                {title}
                                            </Button>
                                        ) : (
                                            title
                                        )
                                    }
                                    subtitle={subtitle || undefined}
                                    // Wide trailing values (hub with label) only fit in the header on wide cards;
                                    // narrow cards (container < 28rem) show them below the title instead.
                                    trailing={trailing ? <div className="hidden @md:flex items-center gap-3">{trailing}</div> : undefined}
                                    actions={ctx.actions?.(data)}
                                />
                                {trailing && <div className="flex @md:hidden flex-wrap items-center gap-3 px-1">{trailing}</div>}
                                {/* Meta lives below the header: in the header center it squeezed the title (EntityCard 1fr column). */}
                                <EntityCard.Meta
                                    items={metaDefs.map(({ id, def }) => ({ key: id, label: def.label, value: <FieldValue def={def} row={data} surface="card" align="start" /> }))}
                                />
                                {layout.body && <CardBody section={layout.body} entity={entity} row={data} />}
                            </EntityCard>
                        </li>
                    )
                })}
            </ul>
            {ctx.collection.paginated && <DataTablePagination table={table} />}
        </div>
    )
}

function CardBody<T, Id extends string>({ section, entity, row }: { section: CardSection<T, Id>; entity: EntityRef<T>; row: T }) {
    const metric = (id: Id) => {
        const def = fieldById(entity, id)
        return { label: def.label, value: <FieldValue def={def} row={row} surface="card" align="start" /> }
    }
    switch (section.kind) {
        case "workflow": {
            const ids = [section.lines, section.total, section.pending, section.date].filter((id): id is Id => !!id)
            return <EntityCard.Metrics metrics={ids.map(metric)} className="flex-wrap" />
        }
        case "metrics":
            return <EntityCard.Metrics metrics={section.fields.map(metric)} className="flex-wrap" />
        case "progress":
            return (
                <EntityCard.Body>
                    <FieldValue def={fieldById(entity, section.field)} row={row} surface="card" align="start" />
                </EntityCard.Body>
            )
        case "custom": {
            const Section = section.component
            return <Section row={row} />
        }
    }
}

// ─── Public compound ─────────────────────────────────────────────────────────

export const Collection = Object.assign(Root, { Root, Toolbar, View, Table: TableSurface, Grid })

