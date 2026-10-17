"use client"

import * as React from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { alignOf, fieldById, type Entity, type FieldId, type FieldMap } from "../core/define-entity"
import { formatNumber, formatMoneyValue } from "../core/formatters"
import { ALIGN_TEXT } from "../core/align"
import { CELL, FieldValue, HEADER_TEXT } from "./Collection"

// ─── Definition ──────────────────────────────────────────────────────────────

export interface EditableInput<T> {
    kind: "quantity" | "money"
    header: string
    /** Accessible name derived from the row (AX-6, ED-1), e.g. "Cantidad a despachar — Papel couché". */
    label: (row: T) => string
    min?: number
    max?: (row: T) => number
    step?: (row: T) => number
    initial?: (row: T) => number
    /** Unit of the quantity (e.g. the line UoM). Footer totals are grouped by unit. */
    unit?: (row: T) => string | null | undefined
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

export interface EditableSpec<T, Id extends string, Inputs extends Record<string, EditableInput<T>>> {
    rowKey: (row: T) => string | number
    /** Read-only context columns, by entity field id. */
    context: readonly Id[]
    inputs: Inputs
    eligible?: (row: T) => Eligibility
    footer?: { sum?: readonly (keyof Inputs & string)[] }
    bulk?: readonly ("fillToMax" | "clear")[]
    /** Domain wording for the bulk helpers, e.g. "Despachar todo lo pendiente". */
    bulkLabels?: { fillToMax?: string; clear?: string }
}

export interface EditableDefinition<T, F extends FieldMap<T>, Inputs extends Record<string, EditableInput<T>>>
    extends EditableSpec<T, FieldId<F>, Inputs> {
    entity: Entity<T, F>
}

export function defineEditable<T, F extends FieldMap<T>, Inputs extends Record<string, EditableInput<T>>>(
    entity: Entity<T, F>,
    spec: EditableSpec<T, FieldId<F>, Inputs>,
): EditableDefinition<T, F, Inputs> {
    return { entity, ...spec }
}

// ─── Values & schema (react-hook-form + zodResolver, invariant #9) ───────────

/** Decimals shown for an input: integer steps (units, packs) show none. */
function decimalsFor<T>(input: EditableInput<T>, row: T): number {
    const step = input.step?.(row)
    return step !== undefined && step >= 1 ? 0 : 2
}

/**
 * Eligibility including the cap: a row with nothing left to process (max 0) is not editable,
 * instead of offering an input that can only hold 0.
 */
export function eligibilityOf<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>(def: EditableDefinition<T, F, I>, row: T): Eligibility {
    const declared = def.eligible?.(row) ?? { ok: true }
    if (!declared.ok) return declared
    const caps = Object.values(def.inputs).map((input) => input.max?.(row))
    if (caps.length > 0 && caps.every((max) => max !== undefined && max <= 0)) return { ok: false, reason: "Sin pendiente" }
    return declared
}

export interface EditableRowValue {
    key: string
    values: Record<string, number>
}

export function initialEditableValues<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>(
    def: EditableDefinition<T, F, I>,
    rows: readonly T[],
): EditableRowValue[] {
    return rows.map((row) => {
        const eligible = eligibilityOf(def, row)
        const values: Record<string, number> = {}
        for (const [name, input] of Object.entries(def.inputs)) {
            values[name] = eligible.ok ? input.initial?.(row) ?? 0 : 0
        }
        return { key: String(def.rowKey(row)), values }
    })
}

/** Zod schema with per-row caps and eligibility; error paths point at `[index, "values", input]`. */
export function editableSchema<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>(
    def: EditableDefinition<T, F, I>,
    rows: readonly T[],
) {
    const byKey = new Map(rows.map((row) => [String(def.rowKey(row)), row]))
    return z
        .array(z.object({ key: z.string(), values: z.record(z.string(), z.number()) }))
        .superRefine((lines, ctx) => {
            let processed = 0
            lines.forEach((line, index) => {
                const row = byKey.get(line.key)
                if (!row) return
                const eligible = eligibilityOf<T, F, I>(def, row)
                for (const [name, input] of Object.entries(def.inputs)) {
                    const value = line.values[name] ?? 0
                    if (value > 0) processed++
                    const min = input.min ?? 0
                    const max = input.max?.(row)
                    if (!eligible.ok && value > 0) {
                        ctx.addIssue({ code: "custom", path: [index, "values", name], message: eligible.reason })
                    } else if (value < min) {
                        ctx.addIssue({ code: "custom", path: [index, "values", name], message: `Mínimo ${min}` })
                    } else if (max !== undefined && value > max) {
                        ctx.addIssue({ code: "custom", path: [index, "values", name], message: `Máx. ${formatNumber(max, decimalsFor(input, row))}` })
                    }
                }
            })
            if (processed === 0) ctx.addIssue({ code: "custom", path: [], message: "Ingresa al menos una cantidad" })
        })
}

/** Error map `{ [rowKey]: { [input]: message } }` from a zod error (or RHF field errors flattened to it). */
export type EditableErrors = Record<string, Record<string, string>>

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
    const byKey = React.useMemo(() => new Map(value.map((v) => [v.key, v])), [value])
    // One lookup map for bulk helpers and footer totals (avoids rows.find inside loops).
    const rowByKey = React.useMemo(() => new Map(rows.map((r) => [String(def.rowKey(r)), r])), [rows, def])
    const idBase = React.useId()

    const setValue = (key: string, name: string, next: number) =>
        onChange(value.map((v) => (v.key === key ? { ...v, values: { ...v.values, [name]: next } } : v)))

    const bulk = (mode: "fillToMax" | "clear") =>
        onChange(
            value.map((v) => {
                const row = rowByKey.get(v.key)
                if (!row) return v
                const eligible = eligibilityOf<T, F, I>(def, row)
                const values: Record<string, number> = {}
                for (const name of inputNames) {
                    values[name] = mode === "clear" || !eligible.ok ? 0 : def.inputs[name].max?.(row) ?? v.values[name] ?? 0
                }
                return { ...v, values }
            }),
        )

    const sums = def.footer?.sum ?? []

    return (
        <div className="flex flex-col gap-2">
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
            <div className="overflow-auto rounded-md border">
                <table className="w-full text-sm" aria-label={label}>
                    <thead className="bg-background">
                        <tr className="border-b">
                            {def.context.map((id, i) => {
                                const field = fieldById(def.entity, id)
                                return (
                                    // The first column absorbs the free width so the inputs sit next to their reference columns.
                                    <th key={id} scope="col" className={cn("px-(--table-header-px) py-(--table-header-py) whitespace-nowrap", HEADER_TEXT, i === 0 && "w-full", ALIGN_TEXT[alignOf(field)])}>
                                        {field.header ?? field.label}
                                    </th>
                                )
                            })}
                            {inputNames.map((name) => (
                                <th key={name} scope="col" className={cn("px-(--table-header-px) py-(--table-header-py) text-right", HEADER_TEXT)}>
                                    {def.inputs[name].header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const key = String(def.rowKey(row))
                            const eligible = eligibilityOf(def, row)
                            const reasonId = `${idBase}-${key}-reason`
                            return (
                                <tr key={key} className={cn("border-b border-border/40", !eligible.ok && "opacity-60")}>
                                    {def.context.map((id, i) => (
                                        <td key={id} className={cn(CELL, "align-middle")}>
                                            <FieldValue def={fieldById(def.entity, id)} row={row} surface="table" />
                                            {i === 0 && !eligible.ok && (
                                                <span id={reasonId} className="block text-2xs text-muted-foreground">{eligible.reason}</span>
                                            )}
                                        </td>
                                    ))}
                                    {inputNames.map((name) => {
                                        const input = def.inputs[name]
                                        const error = errors[key]?.[name]
                                        const errorId = `${idBase}-${key}-${name}-error`
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
                                                    disabled={disabled || !eligible.ok}
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
                                </tr>
                            )
                        })}
                    </tbody>
                    {sums.length > 0 && (
                        <tfoot className="border-t bg-muted/30">
                            <tr>
                                <td colSpan={def.context.length} className={cn(CELL, HEADER_TEXT)}>Total</td>
                                {inputNames.map((name) => {
                                    if (!sums.includes(name)) return <td key={name} />
                                    const input = def.inputs[name]
                                    const totals = new Map<string, number>()
                                    for (const v of value) {
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
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}

/**
 * Maps react-hook-form field errors (from `zodResolver(editableSchema)`) to `EditableErrors`.
 * Pass `form.formState.errors.<name>`: the resolver is the single validation (invariant #9).
 */
export function editableErrorsFromForm(errors: unknown, value: EditableRowValue[]): EditableErrors {
    const out: EditableErrors = {}
    if (!errors || typeof errors !== "object") return out
    value.forEach((row, index) => {
        const rowError = (errors as Record<number, unknown>)[index]
        if (!rowError || typeof rowError !== "object") return
        const values = (rowError as { values?: unknown }).values
        if (!values || typeof values !== "object") return
        for (const [name, fieldError] of Object.entries(values as Record<string, unknown>)) {
            const message = fieldError && typeof fieldError === "object" ? (fieldError as { message?: unknown }).message : undefined
            if (typeof message === "string") out[row.key] = { ...out[row.key], [name]: message }
        }
    })
    return out
}

/** Flattens a zod error from `editableSchema` into `EditableErrors`. */
export function toEditableErrors(error: z.ZodError, value: EditableRowValue[]): EditableErrors {
    const out: EditableErrors = {}
    for (const issue of error.issues) {
        const [index, , name] = issue.path
        if (typeof index !== "number" || typeof name !== "string") continue
        const key = value[index]?.key
        if (!key) continue
        out[key] = { ...out[key], [name]: issue.message }
    }
    return out
}
