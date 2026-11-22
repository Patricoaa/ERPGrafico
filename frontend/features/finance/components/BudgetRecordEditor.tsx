"use client"

import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { SkeletonShell } from "@/components/shared"
import { useRecordById } from "@/hooks/useRecordById"
import { FINANCE_KEYS } from "../hooks/queryKeys"
import type { Budget } from "../hooks/useBudgets"
import { BudgetEditor } from "./BudgetEditor"

interface BudgetRecordEditorProps {
    id: number
    /** Fila de la lista, si el llamador ya la tiene (evita la consulta). */
    data?: unknown
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Editor de un presupuesto como pestaña propia (ADR-0152). Guardar no cierra la pestaña (el editor sigue
 * abierto para seguir ajustando líneas): avisa y refresca la lista.
 */
export function BudgetRecordEditor({ id, data, open, onOpenChange }: BudgetRecordEditorProps) {
    const queryClient = useQueryClient()
    const { record, isError } = useRecordById<Budget>("/accounting/budgets", data ? null : id)
    const budget = (data as Budget | undefined) ?? record
    if (!budget) return isError ? null : <SkeletonShell isLoading ariaLabel="Cargando presupuesto" />
    return (
        <BudgetEditor
            open={open}
            onOpenChange={onOpenChange}
            budget={budget}
            onSave={() => {
                void queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.budgets.lists() })
                toast.success("Presupuesto actualizado")
            }}
        />
    )
}
