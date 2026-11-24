"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, StatusBadge } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import type { EmployeeMovement } from "@/types/hr"
import { useEmployeeMovementHistory } from "../hooks/useEmployeeMovementHistory"
import { LoanScheduleTable } from "./LoanScheduleTable"
import { NewEmployeeMovementFlow } from "./NewEmployeeMovementFlow"

interface EmployeeMovementsHistoryProps {
    employeeId: number
    onOpen: (movement: EmployeeMovement) => void
}

/** Historial unificado de pagos, anticipos y préstamos de un empleado, con el estado de cada uno (ADR-0156). */
export function EmployeeMovementsHistory({ employeeId, onOpen }: EmployeeMovementsHistoryProps) {
    const { movements, isLoading, isError } = useEmployeeMovementHistory(employeeId)
    const [expanded, setExpanded] = useState<number | null>(null)
    const [creating, setCreating] = useState<"ADVANCE" | "LOAN" | null>(null)

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

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando movimientos…</p>
            ) : isError ? (
                <p role="alert" className="text-sm text-destructive">No se pudo cargar el historial de movimientos.</p>
            ) : movements.length === 0 ? (
                <EmptyState variant="compact" title="Sin movimientos" description="Los pagos, anticipos y préstamos del empleado aparecerán aquí." />
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                                <th className="px-3 py-2 text-left font-medium">Folio</th>
                                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                                <th className="px-3 py-2 text-right font-medium">Monto</th>
                                <th className="px-3 py-2 text-right font-medium">Saldo</th>
                                <th className="px-3 py-2 text-left font-medium">Estado</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {movements.map((movement) => {
                                const isOpen = expanded === movement.id
                                const hasSchedule = movement.kind === "LOAN" && movement.installments.length > 0
                                return (
                                    <Fragment key={movement.id}>
                                        <tr className="border-t border-border">
                                            <td className="px-3 py-2">{movement.kind_display}</td>
                                            <td className="px-3 py-2">
                                                <button type="button" className="text-primary hover:underline" onClick={() => onOpen(movement)}>{movement.display_id}</button>
                                            </td>
                                            <td className="px-3 py-2">{movement.date}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(movement.amount))}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{movement.kind === "PAYMENT" ? "—" : formatCurrency(Number(movement.balance))}</td>
                                            <td className="px-3 py-2"><StatusBadge status={movement.status} label={movement.status_display} /></td>
                                            <td className="px-3 py-2 text-right">
                                                {hasSchedule && (
                                                    <Button type="button" variant="ghost" size="sm" aria-label="Ver cuotas" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : movement.id)}>
                                                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="border-t border-border bg-muted/20">
                                                <td colSpan={7} className="px-3 py-3"><LoanScheduleTable rows={movement.installments} /></td>
                                            </tr>
                                        )}
                                    </Fragment>
                                )
                            })}
                        </tbody>
                    </table>
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
