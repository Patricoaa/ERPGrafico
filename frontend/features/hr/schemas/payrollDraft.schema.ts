import { z } from "zod"

/** Fila de `EditableCollection` (`EditableRowValue`): los errores apuntan a `[índice, "values", input]`. */
const editableLine = z.object({
    key: z.string(),
    values: z.record(z.string(), z.number()),
    textValues: z.record(z.string(), z.string()).optional(),
    selected: z.boolean().optional(),
})

/**
 * Borrador de liquidación editado en su ficha: conceptos (monto ≥ 0) y anticipos/préstamos
 * asignados (monto > 0 y ≤ tope). `advanceMax` da el tope por fila (saldo libre + lo ya asignado).
 */
export function payrollDraftSchema(advanceMax: (key: string) => number | undefined) {
    return z.object({
        items: z.array(editableLine).superRefine((lines, ctx) => {
            lines.forEach((line, index) => {
                if ((line.values.amount ?? 0) < 0) {
                    ctx.addIssue({ code: "custom", path: [index, "values", "amount"], message: "El monto no puede ser negativo" })
                }
            })
        }),
        advances: z.array(editableLine).superRefine((lines, ctx) => {
            lines.forEach((line, index) => {
                const amount = line.values.amount ?? 0
                const max = advanceMax(line.key)
                if (amount <= 0) {
                    ctx.addIssue({ code: "custom", path: [index, "values", "amount"], message: "Debe ser mayor a 0" })
                } else if (max !== undefined && amount > max) {
                    ctx.addIssue({ code: "custom", path: [index, "values", "amount"], message: "Supera el saldo del movimiento" })
                }
            })
        }),
    })
}

export type PayrollDraftValues = z.infer<ReturnType<typeof payrollDraftSchema>>
