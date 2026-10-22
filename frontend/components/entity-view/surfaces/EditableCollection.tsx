"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectionRing } from "@/components/shared/SelectionRing"
import { StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"
import { alignOf, fieldById, type FieldMap } from "../core/define-entity"
import { formatNumber, formatMoneyValue } from "../core/formatters"
import { decimalsFor, eligibilityOf, processedInputs, type EditableDefinition, type EditableErrors, type EditableInput, type EditableRowValue } from "../core/define-editable"
import { ALIGN_TEXT } from "../core/align"
import { CELL, FieldValue, HEADER_TEXT } from "./Collection"

/**
 * Moves focus to the first invalid cell (AX-6). Pass it as the invalid handler of
 * `form.handleSubmit(onValid, () => focusFirstEditableError())`; it waits one frame for the
 * error state to render.
 */
export function focusFirstEditableError(root: ParentNode = document): void {
    requestAnimationFrame(() => {
        root.querySelector<HTMLInputElement>('[data-editable-collection] input[aria-invalid="true"]')?.focus()
    })
}

// ─── Surface ─────────────────────────────────────────────────────────────────

export interface EditableCollectionProps<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>> {
    definition: EditableDefinition<T, F, I>
    rows: readonly T[]
    value: EditableRowValue[]
    onChange: (next: EditableRowValue[]) => void
    errors?: EditableErrors
    /** Accessible name of the table. */
    label: string
    disabled?: boolean
}

export function EditableCollection<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>({
    definition: def,
    rows,
    value,
    onChange,
    errors = {},
    label,
    disabled,
}: EditableCollectionProps<T, F, I>) {
    const inputNames = Object.keys(def.inputs) as (keyof I & string)[]
    const processed = processedInputs(def)
    const byKey = React.useMemo(() => new Map(value.map((v) => [v.key, v])), [value])
    // One lookup map for bulk helpers and footer totals (avoids rows.find inside loops).
    const rowByKey = React.useMemo(() => new Map(rows.map((r) => [String(def.rowKey(r)), r])), [rows, def])
    // Resolved once per rows/definition, not per keystroke: eligibility evaluates every cap of the row.
    const eligibility = React.useMemo(() => new Map(rows.map((r) => [String(def.rowKey(r)), eligibilityOf<T, F, I>(def, r)])), [rows, def])
    const contextFields = React.useMemo(
        () => def.context.map((id) => {
            const field = fieldById(def.entity, id)
            return { id, field, align: alignOf(field) }
        }),
        [def],
    )
    const idBase = React.useId()
    const hasSelect = def.select !== undefined

    const setValue = (key: string, name: string, next: number) =>
        onChange(value.map((v) => (v.key === key ? { ...v, values: { ...v.values, [name]: next } } : v)))

    const setTextValue = (key: string, name: string, next: string) =>
        onChange(value.map((v) => (v.key === key ? { ...v, textValues: { ...v.textValues, [name]: next } } : v)))

    const setSelected = (key: string, next: boolean) =>
        onChange(value.map((v) => (v.key === key ? { ...v, selected: next } : v)))

    // E3: row is "active" (inputs enabled) when no select spec, or when selected.
    const isRowActive = (key: string): boolean => {
        if (!hasSelect) return true
        return byKey.get(key)?.selected ?? false
    }

    const bulk = (mode: "fillToMax" | "clear") =>
        onChange(
            value.map((v) => {
                // E3: bulk only affects selected rows (or all when no select spec).
                if (hasSelect && !v.selected) return v
                const row = rowByKey.get(v.key)
                if (!row) return v
                const eligible = eligibility.get(v.key) ?? { ok: true }
                // Only the processed inputs: "Limpiar" must not wipe the unit cost of the row.
                const values: Record<string, number> = { ...v.values }
                for (const name of processed) {
                    values[name] = mode === "clear" || !eligible.ok ? 0 : def.inputs[name].max?.(row) ?? v.values[name] ?? 0
                }
                return { ...v, values }
            }),
        )

    const sums = def.footer?.sum ?? []
    const hasStatus = !!def.rowStatus
    // The first column (the product) stays visible while the inputs scroll horizontally on phones (ED-5).
    const STICKY = "sticky left-0 z-[1] bg-card"

    return (
        <div className="flex flex-col gap-2" data-editable-collection="">
            {def.bulk && def.bulk.length > 0 && (
                <div className="flex justify-end gap-2" role="group" aria-label="Acciones masivas">
                    {def.bulk.includes("fillToMax") && (
                        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => bulk("fillToMax")}>{def.bulkLabels?.fillToMax ?? "Completar con el máximo"}</Button>
                    )}
                    {def.bulk.includes("clear") && (
                        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => bulk("clear")}>{def.bulkLabels?.clear ?? "Limpiar"}</Button>
                    )}
                </div>
            )}
            <div className="surface-panel overflow-auto">
                <table className="w-full text-sm" aria-label={label}>
                    <thead className="bg-card">
                        <tr className="border-b">
                            {/* E3: selection checkbox column header */}
                            {hasSelect && <th scope="col" className={cn("px-(--table-header-px) py-(--table-header-py) w-10", HEADER_TEXT)} aria-label="Selección" />}
                            {contextFields.map(({ id, field, align }, i) => (
                                // The first column absorbs the free width so the inputs sit next to their reference columns.
                                <th key={id} scope="col" className={cn("px-(--table-header-px) py-(--table-header-py) whitespace-nowrap", HEADER_TEXT, i === 0 && cn("w-full", !hasSelect && STICKY), ALIGN_TEXT[align])}>
                                    {field.header ?? field.label}
                                </th>
                            ))}
                            {inputNames.map((name) => {
                                const input = def.inputs[name]
                                return (
                                    <th key={name} scope="col" className={cn("px-(--table-header-px) py-(--table-header-py)", input.kind === "text" ? "text-left" : "text-right", HEADER_TEXT)}>
                                        {input.header}
                                    </th>
                                )
                            })}
                            {hasStatus && <th scope="col" className={cn("px-(--table-header-px) py-(--table-header-py)", HEADER_TEXT)}>Estado</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const key = String(def.rowKey(row))
                            const eligible = eligibility.get(key) ?? { ok: true }
                            const rowActive = isRowActive(key)
                            const reasonId = `${idBase}-${key}-reason`
                            return (
                                <tr key={key} className={cn("border-b border-border/40", (!eligible.ok || (hasSelect && !rowActive)) && "opacity-60")}>
                                    {/* E3: per-row selection checkbox */}
                                    {hasSelect && (
                                        <td className={cn(CELL, "text-center align-middle")}>
                                            <SelectionRing
                                                checked={byKey.get(key)?.selected ?? false}
                                                onCheckedChange={(v) => setSelected(key, !!v)}
                                                disabled={disabled || !eligible.ok}
                                                aria-label={def.select?.label(row) ?? ""}
                                                size="sm"
                                            />
                                        </td>
                                    )}
                                    {contextFields.map(({ id, field, align }, i) => (
                                        <td key={id} className={cn(CELL, "align-middle", i === 0 && !hasSelect ? STICKY : "whitespace-nowrap", ALIGN_TEXT[align])}>
                                            <FieldValue def={field} row={row} surface="table" align={align} />
                                            {i === 0 && !eligible.ok && (
                                                <span id={reasonId} className="block text-2xs text-muted-foreground">{eligible.reason}</span>
                                            )}
                                        </td>
                                    ))}
                                    {inputNames.map((name) => {
                                        const input = def.inputs[name]
                                        const error = errors[key]?.[name]
                                        const errorId = `${idBase}-${key}-${name}-error`
                                        const isDisabled = disabled || !eligible.ok || (hasSelect && !rowActive)
                                        const isReadOnly = typeof input.readOnly === "function" ? input.readOnly(row) : (input.readOnly ?? false)
                                        // E2: text inputs use textValues, align left
                                        if (input.kind === "text") {
                                            return (
                                                <td key={name} className={cn(CELL, "align-top text-left")}>
                                                    <Input
                                                        type="text"
                                                        placeholder={input.placeholder}
                                                        aria-label={input.label(row)}
                                                        aria-invalid={!!error}
                                                        aria-describedby={error ? errorId : undefined}
                                                        disabled={isDisabled}
                                                        value={byKey.get(key)?.textValues?.[name] ?? ""}
                                                        onChange={(e) => setTextValue(key, name, e.target.value)}
                                                        className={cn("h-8 w-40", error && "border-destructive")}
                                                    />
                                                    {error && (
                                                        <span id={errorId} role="alert" className="mt-0.5 block text-2xs text-destructive">{error}</span>
                                                    )}
                                                </td>
                                            )
                                        }
                                        // readOnly: show formatted value as text (E2.5)
                                        if (isReadOnly) {
                                            const currentVal = byKey.get(key)?.values[name] ?? 0
                                            const formatted = input.kind === "money"
                                                ? formatMoneyValue(currentVal)
                                                : formatNumber(currentVal, decimalsFor(input, row))
                                            return (
                                                <td key={name} className={cn(CELL, "align-middle text-right text-sm tabular-nums text-muted-foreground")}>
                                                    {formatted}
                                                </td>
                                            )
                                        }
                                        const max = input.max?.(row)
                                        const hintId = `${idBase}-${key}-${name}-hint`
                                        return (
                                            <td key={name} className={cn(CELL, "align-top text-right")}>
                                                {/* No native min/max: HTML constraint validation would block the submit before
                                                    the zod resolver runs and show the browser bubble instead of our error. */}
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    aria-label={input.label(row)}
                                                    aria-invalid={!!error}
                                                    aria-describedby={cn(error && errorId, max !== undefined && eligible.ok && hintId, !eligible.ok && reasonId) || undefined}
                                                    step={input.step?.(row) ?? "any"}
                                                    disabled={isDisabled}
                                                    value={byKey.get(key)?.values[name] ?? 0}
                                                    onChange={(e) => setValue(key, name, e.target.value === "" ? 0 : Number(e.target.value))}
                                                    className={cn("ml-auto h-8 w-28 text-right tabular-nums", error && "border-destructive")}
                                                />
                                                {error ? (
                                                    <span id={errorId} role="alert" className="mt-0.5 block text-2xs text-destructive">{error}</span>
                                                ) : max !== undefined && eligible.ok ? (
                                                    <span id={hintId} className="mt-0.5 block text-2xs text-muted-foreground">Máx. {formatNumber(max, input.kind === "money" ? 0 : decimalsFor(input, row))}</span>
                                                ) : null}
                                            </td>
                                        )
                                    })}
                                    {hasStatus && <RowStatusCell def={def} row={row} values={byKey.get(key)?.values ?? {}} isActive={rowActive} />}
                                </tr>
                            )
                        })}
                    </tbody>
                    {sums.length > 0 && (
                        <tfoot className="border-t bg-muted/30">
                            <tr>
                                <td colSpan={def.context.length + (hasSelect ? 1 : 0)} className={cn(CELL, HEADER_TEXT)}>Total</td>
                                {inputNames.map((name) => {
                                    if (!sums.includes(name)) return <td key={name} />
                                    const input = def.inputs[name]
                                    if (input.kind === "text") return <td key={name} />
                                    const totals = new Map<string, number>()
                                    for (const v of value) {
                                        // E3: skip unselected rows in footer sums
                                        if (hasSelect && !v.selected) continue
                                        if (errors[v.key]?.[name]) continue // invalid cells do not count toward the total
                                        const row = rowByKey.get(v.key)
                                        const unit = (row && input.unit?.(row)) ?? ""
                                        totals.set(unit, (totals.get(unit) ?? 0) + (v.values[name] ?? 0))
                                    }
                                    const nonZero = [...totals.entries()].filter(([, total]) => total !== 0)
                                    const text = nonZero.length === 0 ? "—" : nonZero
                                        .map(([unit, total]) => (input.kind === "money" ? formatMoneyValue(total) : formatNumber(total, total % 1 === 0 ? 0 : 2, unit || undefined)))
                                        .join(" · ")
                                    return <td key={name} className={cn(CELL, "text-right text-xs font-semibold tabular-nums")} aria-live="polite">{text}</td>
                                })}
                                {hasStatus && <td />}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}

function RowStatusCell<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>({ def, row, values, isActive }: { def: EditableDefinition<T, F, I>; row: T; values: Record<string, number>; isActive: boolean }) {
    // E3: empty cell for unselected rows
    if (def.select && !isActive) return <td className={cn(CELL, "align-middle")} />
    // Missing inputs read as 0, so the callback always receives every declared input.
    const full = Object.fromEntries(
        Object.keys(def.inputs).filter((n) => def.inputs[n].kind !== "text").map((name) => [name, values[name] ?? 0])
    ) as Record<keyof I & string, number>
    const status = def.rowStatus?.(row, full)
    return (
        <td className={cn(CELL, "align-middle whitespace-nowrap")} aria-live="polite">
            {status && <StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />}
        </td>
    )
}
