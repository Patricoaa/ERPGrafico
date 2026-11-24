"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { EmployeeMovement } from "@/types/hr"
import { useEmployeeMovementHistory } from "../hooks/useEmployeeMovementHistory"
import { employeeMovementEntity, employeeMovementViews } from "../entity-view/employeeMovement.entity"
import { employeeMovementHistoryActions } from "../employeeMovementActions"
import { LoanScheduleTable } from "./LoanScheduleTable"
import { NewEmployeeMovementFlow } from "./NewEmployeeMovementFlow"

interface EmployeeMovementsHistoryProps {
    employeeId: number
    onOpen: (movement: EmployeeMovement) => void
}

const HISTORY_COLUMNS = employeeMovementViews.table.without("employee")

/** Historial unificado de pagos, anticipos y préstamos de un empleado, con el estado de cada uno (ADR-0156). */
export function EmployeeMovementsHistory({ employeeId, onOpen }: EmployeeMovementsHistoryProps) {
    const { movements, isLoading, isError, refetch } = useEmployeeMovementHistory(employeeId)
    const [scheduleOf, setScheduleOf] = useState<EmployeeMovement | null>(null)
    const [creating, setCreating] = useState<"ADVANCE" | "LOAN" | null>(null)
    const collection = useEntityCollection(
        employeeMovementEntity,
        { rows: movements, isLoading, error: isError && movements.length === 0, refetch },
        { pagination: { mode: "more" }, sorting: { mode: "local" } },
    )

    return (
        // Los formularios de los drawers hijos se portalean dentro de este árbol de React: sus `submit`
        // no deben llegar al formulario de la ficha del empleado.
        <div className="space-y-4" onSubmit={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreating("ADVANCE")}>
                    <Plus className="mr-1 h-4 w-4" />Nuevo anticipo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setCreating("LOAN")}>
                    <Plus className="mr-1 h-4 w-4" />Nuevo préstamo
                </Button>
            </div>

            <Collection.Root
                collection={collection}
                label="Movimientos del empleado"
                onOpen={onOpen}
                actions={employeeMovementHistoryActions.forCollection({ onViewSchedule: setScheduleOf })}
            >
                <Collection.View
                    table={HISTORY_COLUMNS}
                    emptyTitle="Sin movimientos"
                    emptyDescription="Los pagos, anticipos y préstamos del empleado aparecerán aquí."
                />
            </Collection.Root>

            {scheduleOf && (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Cuotas de {scheduleOf.display_id}</p>
                    <LoanScheduleTable rows={scheduleOf.installments} />
                </div>
            )}

            {creating && (
                <NewEmployeeMovementFlow
                    open
                    onOpenChange={(o) => { if (!o) setCreating(null) }}
                    employeeId={employeeId}
                    initialKind={creating}
                />
            )}
        </div>
    )
}
