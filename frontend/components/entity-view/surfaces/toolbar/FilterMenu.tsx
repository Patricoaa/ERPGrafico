"use client"

import * as React from "react"
import { ListFilter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { FacetCounts } from "@/lib/facets"
import { cn } from "@/lib/utils"
import type {
    DateFilterDef,
    DropdownFilterDef,
    MultiSelectFilterDef,
    MultiSelectOption,
    RangeFilterDef,
    SingleSelectFilterDef,
    ToggleFilterDef,
} from "@/types/unified-search"
import { CommandButton, PeriodPanel } from "@/components/shared"

export type MenuFilter = Exclude<DropdownFilterDef, { type: "custom" }> | DateFilterDef

type Values = Record<string, string | null>
type ApplyMany = (values: Values) => Promise<void>

/** Params a filter owns (one, or from/to). */
export function filterParams(filter: MenuFilter): string[] {
    switch (filter.type) {
        case "range":
            return [filter.serverParamFrom, filter.serverParamTo]
        case "date":
            return [...new Set(filter.options.flatMap((o) => [o.serverParamFrom, o.serverParamTo]).filter((p): p is string => !!p))]
        default:
            return [filter.serverParam]
    }
}

/** Chosen values shown next to the filter name: the multi-select count, otherwise 1 when set. */
export function activeCount(filter: MenuFilter, values: Values): number {
    if (filter.type === "multi") return (values[filter.serverParam] ?? "").split(",").filter(Boolean).length
    return filterParams(filter).some((p) => values[p]) ? 1 : 0
}

/** A pane registers how to apply its draft, so closing the menu applies it (collection-toolbar §5.1). */
type CommitRef = React.RefObject<(() => void) | null>

const SEARCHABLE_AT = 8

interface FilterMenuProps {
    filters: readonly MenuFilter[]
    values: Values
    filterOptions?: Record<string, MultiSelectOption[]>
    /** Per-option counts by filter param (`facets/`, ADR-0158 §8): shown next to each option; 0 disables it. */
    counts?: FacetCounts | null
    applyMany: ApplyMany
}

/**
 * Two-pane filter menu (ADR-0158 §5): filters on the left (search, chosen-value count), values of
 * the selected one on the right. `toggle` / `single` apply at once; `multi`, `range` and a custom
 * `date` range apply with «Aplicar» or when the menu closes; Esc discards.
 */
export function FilterMenu({ filters, values, filterOptions, counts = null, applyMany }: FilterMenuProps) {
    const [open, setOpen] = React.useState(false)
    const [currentKey, setCurrentKey] = React.useState<string | null>(null)
    const [find, setFind] = React.useState("")
    const commitRef: CommitRef = React.useRef<(() => void) | null>(null)
    const discard = React.useRef(false)

    const active = filters.filter((f) => activeCount(f, values) > 0).length
    const current = filters.find((f) => f.key === currentKey) ?? filters[0]
    const shown = find ? filters.filter((f) => f.label.toLowerCase().includes(find.toLowerCase())) : filters

    const onOpenChange = (next: boolean) => {
        if (!next) {
            if (!discard.current) commitRef.current?.()
            discard.current = false
            commitRef.current = null
            setFind("")
        }
        setOpen(next)
    }

    if (filters.length === 0) return null

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <CommandButton icon={ListFilter} name="Filtros" value={active > 0 ? active : undefined} valueLabel={`${active} ${active === 1 ? "activo" : "activos"}`} badge aria-expanded={open} />
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[min(92vw,30rem)] p-0"
                onEscapeKeyDown={() => {
                    discard.current = true
                }}
            >
                <div className="grid grid-cols-[11rem_1fr]">
                    <div className="border-r border-border/50 py-1">
                        {filters.length > 6 && (
                            <label className="mx-2 my-1 flex h-control-xs items-center gap-1.5 rounded-sm border border-border/40 px-2 text-muted-foreground">
                                <Search className="size-3.5" aria-hidden />
                                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Buscar filtro…" aria-label="Buscar filtro" className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
                            </label>
                        )}
                        <ul aria-label="Filtros" className="flex flex-col">
                            {shown.map((filter) => {
                                const count = activeCount(filter, values)
                                const isCurrent = filter.key === current?.key
                                return (
                                    <li key={filter.key}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-pressed={isCurrent}
                                            onClick={() => {
                                                commitRef.current?.()
                                                commitRef.current = null
                                                setCurrentKey(filter.key)
                                            }}
                                            className={cn("w-full justify-between rounded-none px-3 text-xs", isCurrent && "bg-muted font-semibold")}
                                        >
                                            <span className="truncate">{filter.label}</span>
                                            {count > 0 && <span className="font-mono text-3xs font-semibold tabular-nums">{count}</span>}
                                        </Button>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                    <div className="flex min-h-48 min-w-0 flex-col">
                        {current && <FilterPane key={current.key} filter={current} values={values} filterOptions={filterOptions} counts={counts} applyMany={applyMany} commitRef={commitRef} />}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface PaneProps<F extends MenuFilter> {
    filter: F
    values: Values
    filterOptions?: Record<string, MultiSelectOption[]>
    counts: FacetCounts | null
    applyMany: ApplyMany
    commitRef: CommitRef
}

function FilterPane(props: PaneProps<MenuFilter>) {
    const { filter } = props
    switch (filter.type) {
        case "multi":
            return <MultiPane {...props} filter={filter} />
        case "single":
            return <SinglePane {...props} filter={filter} />
        case "toggle":
            return <TogglePane {...props} filter={filter} />
        case "range":
            return <RangePane {...props} filter={filter} />
        case "date":
            return <DatePane {...props} filter={filter} />
    }
}

function PaneFooter({ onClear, onApply, canClear, dirty }: { onClear: () => void; onApply?: () => void; canClear: boolean; dirty?: boolean }) {
    return (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/50 px-2 py-1.5">
            <Button variant="ghost" size="sm" className="h-control-xs text-xs text-muted-foreground" disabled={!canClear} onClick={onClear}>
                Quitar
            </Button>
            {onApply && (
                <Button size="sm" className="h-control-xs text-xs" disabled={!dirty} onClick={onApply}>
                    Aplicar
                </Button>
            )}
        </div>
    )
}

function OptionSearch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
        <label className="m-2 flex h-control-xs items-center gap-1.5 rounded-sm border border-border/40 px-2 text-muted-foreground">
            <Search className="size-3.5" aria-hidden />
            <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}…`} aria-label={`Buscar ${label}`} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
        </label>
    )
}

function optionsOf(filter: MultiSelectFilterDef | SingleSelectFilterDef, filterOptions?: Record<string, MultiSelectOption[]>): MultiSelectOption[] {
    const dynamic = filter.dynamic ? filterOptions?.[filter.key] : undefined
    return dynamic ?? filter.options ?? []
}

function MultiPane({ filter, values, filterOptions, counts, applyMany, commitRef }: PaneProps<MultiSelectFilterDef>) {
    const applied = React.useMemo(() => (values[filter.serverParam] ?? "").split(",").filter(Boolean), [values, filter.serverParam])
    const [draft, setDraft] = React.useState<string[]>(applied)
    const [find, setFind] = React.useState("")
    const options = optionsOf(filter, filterOptions)
    const shown = find ? options.filter((o) => o.label.toLowerCase().includes(find.toLowerCase())) : options
    const dirty = draft.join(",") !== applied.join(",")
    // Counts with the other filters applied; an option with none left is disabled unless it is chosen.
    const optionCounts = counts?.fields[filter.serverParam]

    const apply = React.useCallback(() => {
        if (draft.join(",") !== applied.join(",")) void applyMany({ [filter.serverParam]: draft.length ? draft.join(",") : null })
    }, [draft, applied, applyMany, filter.serverParam])
    React.useEffect(() => {
        commitRef.current = apply
    }, [commitRef, apply])

    return (
        <>
            {options.length > SEARCHABLE_AT && <OptionSearch value={find} onChange={setFind} label={filter.label} />}
            <ul aria-label={filter.label} className="max-h-64 overflow-y-auto py-1">
                {shown.map((option) => {
                    const count = optionCounts ? optionCounts[option.value] ?? 0 : null
                    const chosen = draft.includes(option.value)
                    const disabled = count === 0 && !chosen
                    return (
                        <li key={option.value}>
                            <label className={cn("flex items-center gap-2 px-3 py-1.5 text-xs", disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer hover:bg-muted")}>
                                <Checkbox
                                    checked={chosen}
                                    disabled={disabled}
                                    onCheckedChange={(checked) => setDraft((prev) => (checked === true ? [...prev, option.value] : prev.filter((v) => v !== option.value)))}
                                />
                                <span className="truncate">{option.label}</span>
                                {count !== null && <span className="ml-auto font-mono text-3xs tabular-nums text-muted-foreground"><span aria-hidden>{count}</span><span className="sr-only">, {count} {count === 1 ? "resultado" : "resultados"}</span></span>}
                            </label>
                        </li>
                    )
                })}
                {shown.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Sin opciones</li>}
            </ul>
            <PaneFooter canClear={applied.length > 0 || draft.length > 0} dirty={dirty} onApply={apply} onClear={() => { setDraft([]); void applyMany({ [filter.serverParam]: null }) }} />
        </>
    )
}

function SinglePane({ filter, values, filterOptions, applyMany }: PaneProps<SingleSelectFilterDef>) {
    const selected = values[filter.serverParam] ?? ""
    const [find, setFind] = React.useState("")
    const options = optionsOf(filter, filterOptions)
    const shown = find ? options.filter((o) => o.label.toLowerCase().includes(find.toLowerCase())) : options
    return (
        <>
            {options.length > SEARCHABLE_AT && <OptionSearch value={find} onChange={setFind} label={filter.label} />}
            <div role="radiogroup" aria-label={filter.label} className="max-h-64 overflow-y-auto py-1">
                {shown.map((option) => {
                    const checked = option.value === selected
                    return (
                        <Button
                            key={option.value}
                            variant="ghost"
                            size="sm"
                            role="radio"
                            aria-checked={checked}
                            onClick={() => void applyMany({ [filter.serverParam]: option.value })}
                            className={cn("h-control-sm w-full justify-start gap-2 rounded-none px-3 text-xs font-normal", checked && "font-semibold")}
                        >
                            <span className={cn("size-3.5 shrink-0 rounded-full border border-border", checked && "border-4 border-primary")} aria-hidden />
                            <span className="truncate">{option.label}</span>
                        </Button>
                    )
                })}
            </div>
            <PaneFooter canClear={!!selected} onClear={() => void applyMany({ [filter.serverParam]: null })} />
        </>
    )
}

function TogglePane({ filter, values, applyMany }: PaneProps<ToggleFilterDef>) {
    const on = !!values[filter.serverParam]
    return (
        <div className="p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox checked={on} onCheckedChange={(checked) => void applyMany({ [filter.serverParam]: checked === true ? (filter.activeValue ?? "true") : null })} />
                <span>{filter.label}</span>
            </label>
        </div>
    )
}

function RangePane({ filter, values, applyMany, commitRef }: PaneProps<RangeFilterDef>) {
    const appliedFrom = values[filter.serverParamFrom] ?? ""
    const appliedTo = values[filter.serverParamTo] ?? ""
    const [from, setFrom] = React.useState(appliedFrom)
    const [to, setTo] = React.useState(appliedTo)
    const dirty = from !== appliedFrom || to !== appliedTo
    const apply = React.useCallback(() => {
        if (from !== appliedFrom || to !== appliedTo) void applyMany({ [filter.serverParamFrom]: from || null, [filter.serverParamTo]: to || null })
    }, [from, to, appliedFrom, appliedTo, applyMany, filter.serverParamFrom, filter.serverParamTo])
    React.useEffect(() => {
        commitRef.current = apply
    }, [commitRef, apply])
    return (
        <>
            <div className="grid grid-cols-2 gap-2 p-3">
                <label className="flex flex-col gap-1 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {filter.placeholderFrom ?? "Desde"}
                    <Input inputMode="decimal" value={from} onChange={(e) => setFrom(e.target.value)} className="h-control-sm font-mono text-xs" aria-label={`${filter.label} desde`} />
                </label>
                <label className="flex flex-col gap-1 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {filter.placeholderTo ?? "Hasta"}
                    <Input inputMode="decimal" value={to} onChange={(e) => setTo(e.target.value)} className="h-control-sm font-mono text-xs" aria-label={`${filter.label} hasta`} />
                </label>
            </div>
            <PaneFooter canClear={!!(appliedFrom || appliedTo || from || to)} dirty={dirty} onApply={apply} onClear={() => { setFrom(""); setTo(""); void applyMany({ [filter.serverParamFrom]: null, [filter.serverParamTo]: null }) }} />
        </>
    )
}

function DatePane({ filter, values, applyMany, commitRef }: PaneProps<DateFilterDef>) {
    const fromParam = filter.options.find((o) => o.serverParamFrom)?.serverParamFrom
    const toParam = filter.options.find((o) => o.serverParamTo)?.serverParamTo
    const appliedFrom = (fromParam && values[fromParam]) || ""
    const appliedTo = (toParam && values[toParam]) || ""
    const value = React.useMemo(() => (appliedFrom || appliedTo ? { from: appliedFrom || appliedTo, to: appliedTo || appliedFrom } : null), [appliedFrom, appliedTo])
    const presets = React.useMemo(
        () => filter.options.flatMap((o) => (o.getValue ? [{ label: o.label, getValue: o.getValue }] : [])),
        [filter.options],
    )
    const onApply = React.useCallback(
        (period: { from: string; to: string } | null) => {
            const next: Values = {}
            if (fromParam) next[fromParam] = period?.from ?? null
            if (toParam) next[toParam] = period?.to ?? null
            void applyMany(next)
        },
        [fromParam, toParam, applyMany],
    )
    // Same body as the report period control (ADR-0160 §1); closing the menu applies its draft.
    return <PeriodPanel value={value} presets={presets} onApply={onApply} label={filter.label} commitRef={commitRef} />
}
