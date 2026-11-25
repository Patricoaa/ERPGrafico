"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
    editableErrorsFromForm, focusFirstEditableError, initialEditableValues, type EditableRowValue,
} from "@/components/entity-view"
import { useRealtime } from "@/features/realtime"
import { invalidateCrossFeature } from "@/lib/invalidation"
import type { EmployeeMovement, Payroll, PayrollConcept } from "@/types/hr"
import {
    allocateMovement, createPayrollItem, deallocateMovement, deletePayrollItem, updatePayrollItem,
} from "../api/hrApi"
import {
    payrollAdvanceEditable, payrollAdvances, payrollLineEditable, payrollLineFromConcept, payrollLines,
    type PayrollAdvanceRow, type PayrollLineRow,
} from "../entity-view/payrollItem.entity"
import { payrollDraftSchema, type PayrollDraftValues } from "../schemas/payrollDraft.schema"
import { EMPLOYEE_MOVEMENTS_QUERY_KEY, useEmployeeMovements } from "./useEmployeeMovements"
import { PAYROLLS_QUERY_KEY } from "./usePayrolls"

const num = (v: string | number | null | undefined) => {
    const n = parseFloat(String(v ?? 0))
    return Number.isFinite(n) ? n : 0
}

/** Monto sugerido al asignar: la próxima cuota pendiente de un préstamo o el saldo libre de un anticipo. */
export function suggestedAdvanceAmount(movement: EmployeeMovement): number {
    if (movement.kind === "LOAN") {
        const next = movement.installments.find((i) => i.status === "PENDING" && !i.is_allocated)
        if (next) return Math.min(num(next.amount), num(movement.free_balance))
    }
    return num(movement.free_balance)
}

const amountOf = (v: EditableRowValue | undefined) => v?.values.amount ?? 0

/**
 * Edición en la ficha de un borrador de liquidación (conceptos y anticipos/préstamos asignados).
 * Las filas nuevas y las quitadas viven en el formulario hasta `save()`, que aplica la diferencia
 * contra lo guardado: crea/actualiza/elimina líneas y asigna/retira movimientos.
 */
export function usePayrollDraft(payroll: Payroll | null) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const payrollId = payroll?.id ?? 0
    const isDraft = !!payroll && payroll.status !== "POSTED"

    // Sin liquidación cargada filtra por un empleado inexistente: nunca pide todos los movimientos.
    const { movements, isLoading: movementsLoading } = useEmployeeMovements({ employee: String(payroll?.employee ?? 0), status: "POSTED" })
    const freeBalance = useMemo(() => new Map(movements.map((m) => [m.id, num(m.free_balance)])), [movements])

    const baseLines = useMemo(() => (payroll ? payrollLines(payroll) : []), [payroll])
    const baseAdvances = useMemo(() => (payroll ? payrollAdvances(payroll) : []), [payroll])
    const [lines, setLines] = useState<PayrollLineRow[]>(baseLines)
    const [advanceRows, setAdvanceRows] = useState<PayrollAdvanceRow[]>(baseAdvances)

    // El tope de cada anticipo depende del saldo libre actual, que llega aparte: se calcula al pintar.
    const advances = useMemo(
        () => advanceRows.map((r) => ({ ...r, max: r.assigned + Math.max(0, freeBalance.get(r.movement) ?? 0) })),
        [advanceRows, freeBalance],
    )
    const maxRef = useRef(new Map<string, number>())
    maxRef.current = new Map(advances.map((r) => [r.key, r.max]))

    const resolver = useMemo(() => zodResolver(payrollDraftSchema((key) => maxRef.current.get(key))), [])
    const form = useForm<PayrollDraftValues>({
        resolver,
        defaultValues: { items: [], advances: [] },
    })

    // Cuando el servidor devuelve la liquidación, el borrador vuelve a lo guardado; un refetch en
    // segundo plano (foco, tiempo real) no pisa cambios sin guardar, salvo tras guardar.
    const resetPending = useRef(true)
    useEffect(() => {
        if (form.formState.isDirty && !resetPending.current) return
        resetPending.current = false
        setLines(baseLines)
        setAdvanceRows(baseAdvances)
        form.reset({
            items: initialEditableValues(payrollLineEditable, baseLines),
            advances: initialEditableValues(payrollAdvanceEditable, baseAdvances),
        })
    }, [baseLines, baseAdvances, form])

    const nextKey = useRef(0)
    const newKey = (prefix: string) => `${prefix}-new-${++nextKey.current}`

    const addConcept = useCallback((concept: PayrollConcept) => {
        const row = payrollLineFromConcept(concept, newKey("item"))
        setLines((prev) => [...prev, row])
        form.setValue("items", [...form.getValues("items"), ...initialEditableValues(payrollLineEditable, [row])], { shouldDirty: true })
    }, [form])

    const removeLine = useCallback((key: string) => {
        setLines((prev) => prev.filter((r) => r.key !== key))
        form.setValue("items", form.getValues("items").filter((v) => v.key !== key), { shouldDirty: true })
    }, [form])

    const addAdvance = useCallback((movement: EmployeeMovement) => {
        const row: PayrollAdvanceRow = {
            key: newKey("alloc"),
            movement: movement.id,
            displayId: movement.display_id,
            kindDisplay: movement.kind_display,
            detail: "",
            amount: suggestedAdvanceAmount(movement),
            assigned: 0,
            max: num(movement.free_balance),
        }
        setAdvanceRows((prev) => [...prev, row])
        form.setValue("advances", [...form.getValues("advances"), ...initialEditableValues(payrollAdvanceEditable, [row])], { shouldDirty: true })
    }, [form])

    const removeAdvance = useCallback((key: string) => {
        setAdvanceRows((prev) => prev.filter((r) => r.key !== key))
        form.setValue("advances", form.getValues("advances").filter((v) => v.key !== key), { shouldDirty: true })
    }, [form])

    /** Anticipos y préstamos con saldo que aún no están en la tabla. */
    const pendingMovements = useMemo(
        () => movements.filter((m) => m.kind !== "PAYMENT" && num(m.free_balance) > 0 && !advanceRows.some((r) => r.movement === m.id)),
        [movements, advanceRows],
    )

    const mutation = useMutation({
        mutationFn: async (values: PayrollDraftValues) => {
            const items = new Map(values.items.map((v) => [v.key, v]))
            const kept = new Set(lines.map((l) => l.key))
            for (const base of baseLines) {
                if (!kept.has(base.key) && base.id) await deletePayrollItem(payrollId, base.id)
            }
            for (const line of lines) {
                const v = items.get(line.key)
                const amount = String(amountOf(v))
                if (!line.id) {
                    await createPayrollItem(payrollId, { payroll: payrollId, concept: line.concept, amount, description: "" })
                } else if (amountOf(v) !== line.amount) {
                    await updatePayrollItem(payrollId, line.id, { amount })
                }
            }

            const advanceValues = new Map(values.advances.map((v) => [v.key, v]))
            const keptAdvances = new Set(advanceRows.map((r) => r.key))
            for (const base of baseAdvances) {
                if (!keptAdvances.has(base.key) && base.allocationId) await deallocateMovement(base.movement, base.allocationId)
            }
            for (const row of advanceRows) {
                const amount = amountOf(advanceValues.get(row.key))
                if (row.allocationId && amount === row.amount) continue
                // Cambiar el monto de una asignación = retirarla y volver a asignar.
                if (row.allocationId) await deallocateMovement(row.movement, row.allocationId)
                await allocateMovement(row.movement, { payroll: payrollId, amount: String(amount) })
            }
        },
        onSettled: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [PAYROLLS_QUERY_KEY, EMPLOYEE_MOVEMENTS_QUERY_KEY, ["documents", "relations"]])
        },
    })

    /** Valida y guarda; `false` si hay errores (el foco va a la primera celda inválida). */
    const save = useCallback(async (): Promise<boolean> => {
        const ok = await form.trigger()
        if (!ok) {
            focusFirstEditableError()
            return false
        }
        // También tras un error: el guardado pudo quedar a medias y el borrador debe reflejar lo que quedó en el servidor.
        resetPending.current = true
        await mutation.mutateAsync(form.getValues())
        return true
    }, [form, mutation])

    /** El próximo dato del servidor reemplaza el borrador (p. ej. tras generar la propuesta inicial). */
    const resync = useCallback(() => { resetPending.current = true }, [])

    const values = form.watch()
    const errors = form.formState.errors

    return {
        isDraft,
        form,
        lines,
        advances,
        lineValues: values.items ?? [],
        advanceValues: values.advances ?? [],
        setLineValues: (next: EditableRowValue[]) => form.setValue("items", next, { shouldDirty: true }),
        setAdvanceValues: (next: EditableRowValue[]) => form.setValue("advances", next, { shouldDirty: true }),
        lineErrors: editableErrorsFromForm(errors.items, values.items ?? []),
        advanceErrors: editableErrorsFromForm(errors.advances, values.advances ?? []),
        addConcept,
        removeLine,
        addAdvance,
        removeAdvance,
        pendingMovements,
        movementsLoading,
        isDirty: form.formState.isDirty,
        isSaving: mutation.isPending,
        save,
        resync,
    }
}
