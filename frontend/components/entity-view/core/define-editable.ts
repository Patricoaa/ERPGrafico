import { z } from "zod"
import type { Entity, FieldId, FieldMap } from "./define-entity"
import { formatNumber } from "./formatters"
import type { StatusValue } from "./value-kinds"

/*
 * Editable collections (P1/P2, ADR-0087 §6.4): the pure half. It lives in core, with no dependency on
 * `@/components/shared`, so feature definitions evaluated inside the shared import graph (a drawer that a
 * barrel pulls in) find `defineEditable` initialized (TC-044). The surface is `surfaces/EditableCollection`.
 */

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
    /**
     * Domain rule of the cell besides the cap (e.g. "Stock insuficiente (3 disponibles)"). Runs inside
     * the zod schema, so the resolver stays the single validation (invariant #9).
     */
    check?: (row: T, value: number) => string | undefined
}

export type Eligibility = { ok: true } | { ok: false; reason: string }

export interface EditableSpec<T, Id extends string, Inputs extends Record<string, EditableInput<T>>> {
    rowKey: (row: T) => string | number
    /** Read-only context columns, by entity field id. */
    context: readonly Id[]
    inputs: Inputs
    eligible?: (row: T) => Eligibility
    /**
     * Inputs that process the row (the quantity, not its unit cost). They drive "at least one",
     * the "nothing pending" cap and the bulk helpers. Default: every input.
     */
    processed?: readonly (keyof Inputs & string)[]
    /** Per-row status derived from the entered values (Completo / Parcial), rendered by StatusBadge (invariant #7). */
    rowStatus?: (row: T, values: Record<keyof Inputs & string, number>) => StatusValue | null
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
export function decimalsFor<T>(input: EditableInput<T>, row: T): number {
    const step = input.step?.(row)
    return step !== undefined && step >= 1 ? 0 : 2
}

export function processedInputs<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>(def: EditableDefinition<T, F, I>): (keyof I & string)[] {
    return def.processed ? [...def.processed] : (Object.keys(def.inputs) as (keyof I & string)[])
}

/**
 * Eligibility including the cap: a row with nothing left to process (max 0) is not editable,
 * instead of offering an input that can only hold 0.
 */
export function eligibilityOf<T, F extends FieldMap<T>, I extends Record<string, EditableInput<T>>>(def: EditableDefinition<T, F, I>, row: T): Eligibility {
    const declared = def.eligible?.(row) ?? { ok: true }
    if (!declared.ok) return declared
    const caps = processedInputs(def).map((name) => def.inputs[name].max?.(row))
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
    const processedNames = new Set<string>(processedInputs(def))
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
                    if (value > 0 && processedNames.has(name)) processed++
                    const min = input.min ?? 0
                    const max = input.max?.(row)
                    if (!eligible.ok && value > 0) {
                        ctx.addIssue({ code: "custom", path: [index, "values", name], message: eligible.reason })
                    } else if (value < min) {
                        ctx.addIssue({ code: "custom", path: [index, "values", name], message: `Mínimo ${min}` })
                    } else if (max !== undefined && value > max) {
                        ctx.addIssue({ code: "custom", path: [index, "values", name], message: `Máx. ${formatNumber(max, decimalsFor(input, row))}` })
                    } else {
                        const message = value > 0 ? input.check?.(row, value) : undefined
                        if (message) ctx.addIssue({ code: "custom", path: [index, "values", name], message })
                    }
                }
            })
            if (processed === 0) ctx.addIssue({ code: "custom", path: [], message: "Ingresa al menos una cantidad" })
        })
}

/** Error map `{ [rowKey]: { [input]: message } }` from a zod error (or RHF field errors flattened to it). */
export type EditableErrors = Record<string, Record<string, string>>

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
