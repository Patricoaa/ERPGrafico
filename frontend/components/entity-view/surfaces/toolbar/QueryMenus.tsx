"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Columns3, Layers, Plus, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { MAX_SORT_KEYS, type CompiledSortField } from "../../core/define-query"
import { CommandButton } from "@/components/shared"

const SECTION = "px-3 pb-1 pt-2 text-3xs font-semibold uppercase tracking-widest text-muted-foreground"

function parseKey(spec: string): { id: string; desc: boolean } {
    return spec.startsWith("-") ? { id: spec.slice(1), desc: true } : { id: spec, desc: false }
}

// ─── Sort ────────────────────────────────────────────────────────────────────

interface SortMenuProps {
    fields: readonly CompiledSortField[]
    sort: readonly string[]
    defaultSort: readonly string[]
    onChange: (next: string[]) => void
}

/** Up to three sort keys with an explicit direction (ADR-0158 §6). The first key is the one the header shows. */
export function SortMenu({ fields, sort, defaultSort, onChange }: SortMenuProps) {
    const [open, setOpen] = React.useState(false)
    if (fields.length === 0) return null
    const labelOf = (id: string) => fields.find((f) => f.id === id)?.label ?? id
    const keys = sort.map(parseKey)
    const first = keys[0]
    const value = first ? `${labelOf(first.id)} ${first.desc ? "↓" : "↑"}${keys.length > 1 ? ` +${keys.length - 1}` : ""}` : undefined
    const spoken = first ? `${labelOf(first.id)} ${first.desc ? "descendente" : "ascendente"}${keys.length > 1 ? ` y ${keys.length - 1} más` : ""}` : undefined
    const unused = fields.filter((f) => !keys.some((k) => k.id === f.id))
    const write = (next: { id: string; desc: boolean }[]) => onChange(next.map((k) => `${k.desc ? "-" : ""}${k.id}`))

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <CommandButton icon={ArrowUpDown} name="Ordenar" value={value} valueLabel={spoken} aria-expanded={open} />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                <p className={SECTION}>Ordenar por</p>
                <ol aria-label="Claves de orden" className="flex flex-col gap-1 px-2 pb-2">
                    {keys.map((key, index) => (
                        <li key={key.id} className="flex items-center gap-1.5">
                            <span className="w-4 text-center font-mono text-3xs text-muted-foreground">{index + 1}</span>
                            <select
                                aria-label={`Campo ${index + 1}`}
                                value={key.id}
                                onChange={(e) => write(keys.map((k, i) => (i === index ? { ...k, id: e.target.value } : k)))}
                                className="h-control-xs min-w-0 flex-1 rounded-sm border border-border/40 bg-background px-1.5 text-xs"
                            >
                                {[fields.find((f) => f.id === key.id), ...unused].filter((f): f is CompiledSortField => !!f).map((f) => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                className="size-control-xs"
                                aria-label={`${labelOf(key.id)}: ${key.desc ? "descendente, cambiar a ascendente" : "ascendente, cambiar a descendente"}`}
                                onClick={() => write(keys.map((k, i) => (i === index ? { ...k, desc: !k.desc } : k)))}
                            >
                                {key.desc ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUp className="size-3.5" aria-hidden />}
                            </Button>
                            {index > 0 && (
                                <Button variant="ghost" size="icon-sm" className="size-control-xs" aria-label={`Subir ${labelOf(key.id)}`} onClick={() => write([...keys.slice(0, index - 1), key, keys[index - 1], ...keys.slice(index + 1)])}>
                                    <ArrowUp className="size-3 opacity-60" aria-hidden />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" className="size-control-xs" aria-label={`Quitar ${labelOf(key.id)}`} onClick={() => write(keys.filter((_, i) => i !== index))}>
                                <X className="size-3.5" aria-hidden />
                            </Button>
                        </li>
                    ))}
                    {keys.length === 0 && <li className="px-1 py-1 text-xs text-muted-foreground">Orden del servidor</li>}
                </ol>
                <div className="flex items-center justify-between border-t border-border/50 px-2 py-1.5">
                    <Button variant="ghost" size="sm" className="h-control-xs gap-1 text-xs" disabled={keys.length >= MAX_SORT_KEYS || unused.length === 0} onClick={() => write([...keys, { id: unused[0].id, desc: false }])}>
                        <Plus className="size-3.5" aria-hidden />
                        {keys.length === 0 ? "Agregar orden" : "Agregar orden secundario"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-control-xs text-xs text-muted-foreground" onClick={() => onChange([...defaultSort])}>
                        Restablecer
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ─── Group ───────────────────────────────────────────────────────────────────

interface GroupMenuProps {
    fields: readonly { id: string; label: string }[]
    value: string | null
    onChange: (next: string | null) => void
}

/** One grouping level (ADR-0158 §7). */
export function GroupMenu({ fields, value, onChange }: GroupMenuProps) {
    const [open, setOpen] = React.useState(false)
    if (fields.length === 0) return null
    const current = fields.find((f) => f.id === value)
    const options = [{ id: null, label: "Sin agrupar" }, ...fields]
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <CommandButton icon={Layers} name="Agrupar" value={current?.label} aria-expanded={open} />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-0">
                <p className={SECTION}>Agrupar por</p>
                <div role="radiogroup" aria-label="Agrupar por" className="pb-1">
                    {options.map((option) => (
                        <RadioRow
                            key={option.id ?? "none"}
                            label={option.label}
                            checked={(option.id ?? null) === (current?.id ?? null)}
                            onSelect={() => {
                                onChange(option.id)
                                setOpen(false)
                            }}
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

function RadioRow({ label, checked, onSelect }: { label: string; checked: boolean; onSelect: () => void }) {
    return (
        <Button variant="ghost" size="sm" role="radio" aria-checked={checked} onClick={onSelect} className={cn("h-control-sm w-full justify-start gap-2 rounded-none px-3 text-xs font-normal", checked && "font-semibold")}>
            <span className={cn("size-3.5 shrink-0 rounded-full border border-border", checked && "border-4 border-primary")} aria-hidden />
            {label}
        </Button>
    )
}

// ─── Display ─────────────────────────────────────────────────────────────────

export interface LayoutOption {
    value: string
    label: string
    icon: LucideIcon
}

export interface ColumnOption {
    id: string
    label: string
    visible: boolean
    /** The identifier column cannot be hidden. */
    locked?: boolean
}

interface DisplayMenuProps {
    layouts: readonly LayoutOption[]
    layout: string
    onLayoutChange: (next: string) => void
    columns: readonly ColumnOption[]
    onColumnToggle: (id: string, visible: boolean) => void
}

/** Layout and visible columns (ADR-0158 §10). */
export function DisplayMenu({ layouts, layout, onLayoutChange, columns, onColumnToggle }: DisplayMenuProps) {
    const [open, setOpen] = React.useState(false)
    const showLayouts = layouts.length > 1
    const showColumns = columns.length > 0
    if (!showLayouts && !showColumns) return null
    const current = layouts.find((l) => l.value === layout) ?? layouts[0]
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <CommandButton icon={current?.icon ?? Columns3} name="Vista" value={showLayouts ? current?.label : undefined} aria-expanded={open} />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                {showLayouts && (
                    <>
                        <p className={SECTION}>Presentación</p>
                        <div role="radiogroup" aria-label="Presentación" className="grid grid-cols-2 gap-1 px-2 pb-2">
                            {layouts.map((option) => {
                                const Icon = option.icon
                                const checked = option.value === current?.value
                                return (
                                    <Button key={option.value} variant={checked ? "secondary" : "ghost"} size="sm" role="radio" aria-checked={checked} onClick={() => onLayoutChange(option.value)} className="h-control-sm justify-start gap-1.5 text-xs">
                                        <Icon className="size-3.5" aria-hidden />
                                        {option.label}
                                        {checked && <Check className="ml-auto size-3" aria-hidden />}
                                    </Button>
                                )
                            })}
                        </div>
                    </>
                )}
                {showColumns && (
                    <>
                        <p className={cn(SECTION, showLayouts && "border-t border-border/50")}>Columnas</p>
                        <ul aria-label="Columnas" className="max-h-64 overflow-y-auto pb-1">
                            {columns.map((column) => (
                                <li key={column.id}>
                                    <label className={cn("flex items-center gap-2 px-3 py-1.5 text-xs", column.locked ? "text-muted-foreground" : "cursor-pointer hover:bg-muted")}>
                                        <Checkbox aria-label={column.label} checked={column.visible} disabled={column.locked} onCheckedChange={(checked) => onColumnToggle(column.id, checked === true)} />
                                        <span className="truncate">{column.label}</span>
                                        {column.locked && <span className="ml-auto text-3xs">fija</span>}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </PopoverContent>
        </Popover>
    )
}

// ─── Views ───────────────────────────────────────────────────────────────────

interface ViewTabsProps {
    views: readonly { id: string; label: string }[]
    activeId: string | null
    onSelect: (id: string) => void
    dirty: boolean
    onReset: () => void
    /** Right-hand count ("38 resultados"); `null` while loading. */
    count: React.ReactNode
    /** Rows of each view with its own filters (`facets/?views=`), for the views with `count: true`. */
    viewCounts?: Readonly<Record<string, number>>
}

/** Predefined views as tabs (ADR-0158 §9), with «Restablecer» once the state drifts from the view. */
export function ViewTabs({ views, activeId, onSelect, dirty, onReset, count, viewCounts }: ViewTabsProps) {
    return (
        <div className="flex flex-wrap items-center gap-x-1 border-b border-border/50">
            <div role="tablist" aria-label="Vistas" className="flex flex-wrap items-center">
                {views.map((view) => {
                    const selected = view.id === activeId
                    const total = viewCounts?.[view.id]
                    return (
                        <Button
                            key={view.id}
                            variant="ghost"
                            size="sm"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => onSelect(view.id)}
                            className={cn("-mb-px h-control-sm rounded-none border-b-2 border-transparent px-3 text-xs", selected ? "border-primary font-semibold text-foreground" : "text-muted-foreground")}
                        >
                            {view.label}
                            {total !== undefined && (
                                <span className="ml-1.5 font-mono text-3xs font-normal tabular-nums text-muted-foreground">
                                    <span aria-hidden>{total}</span>
                                    <span className="sr-only">, {total} {total === 1 ? "resultado" : "resultados"}</span>
                                </span>
                            )}
                        </Button>
                    )
                })}
            </div>
            {dirty && (
                <span className="flex items-center gap-1.5 text-2xs text-warning-text">
                    Filtros cambiados respecto a la vista
                    <Button variant="link" size="sm" className="h-auto p-0 text-2xs" onClick={onReset}>
                        Restablecer
                    </Button>
                </span>
            )}
            <span aria-live="polite" className="ml-auto font-mono text-2xs tabular-nums text-muted-foreground">{count}</span>
        </div>
    )
}
