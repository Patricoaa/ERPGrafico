"use client"

import { useState } from "react"
import { Link2, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BaseModal, CancelButton, EmptyState, FormFooter, LabeledInput, MoneyDisplay, Section, StatusBadge, SubmitButton } from "@/components/shared"
import { showApiError } from "@/lib/errors"
import type { EmployeeMovement, PayrollAllocation } from "@/types/hr"
import { useEmployeeMovements } from "../../hooks/useEmployeeMovements"
import { useEmployeeMovementMutations } from "../../hooks/useEmployeeMovementMutations"

interface PayrollAllocationsSectionProps {
    payrollId: number
    employeeId: number
    isPosted: boolean
    allocations: PayrollAllocation[]
    /** Aviso (no bloqueante) cuando los descuentos superan el tope legal configurado. */
    capWarning?: string | null
    onChanged: () => void
}

/** Monto sugerido al asignar: la próxima cuota de un préstamo o el saldo de un anticipo. */
function suggestedAmount(movement: EmployeeMovement): string {
    if (movement.kind === "LOAN") {
        const next = movement.installments.find((i) => i.status === "PENDING")
        return next ? String(Number(next.amount)) : ""
    }
    return String(movement.balance)
}

/** Anticipos y préstamos descontados en una liquidación (ADR-0156). */
export function PayrollAllocationsSection({ payrollId, employeeId, isPosted, allocations, capWarning, onChanged }: PayrollAllocationsSectionProps) {
    const [open, setOpen] = useState(false)
    const [amounts, setAmounts] = useState<Record<number, string>>({})
    const [busy, setBusy] = useState<number | null>(null)
    const { allocate, deallocate } = useEmployeeMovementMutations()
    const { movements, isLoading, isError } = useEmployeeMovements({ employee: String(employeeId), status: "POSTED" })
    const pending = movements.filter((mv) => mv.kind !== "PAYMENT" && Number(mv.balance) > 0)

    const handleAssign = async (movement: EmployeeMovement) => {
        setBusy(movement.id)
        try {
            await allocate({ id: movement.id, payroll: payrollId, amount: amounts[movement.id] ?? suggestedAmount(movement) })
            onChanged()
            setOpen(false)
        } catch (e) {
            showApiError(e, "No se pudo asignar a la liquidación")
        } finally {
            setBusy(null)
        }
    }

    const handleRemove = async (allocation: PayrollAllocation) => {
        setBusy(allocation.id)
        try {
            await deallocate({ id: allocation.movement, allocationId: allocation.id })
            onChanged()
        } catch (e) {
            showApiError(e, "No se pudo quitar la asignación")
        } finally {
            setBusy(null)
        }
    }

    return (
        <>
            <Section
                className="mt-6"
                title="Anticipos y préstamos"
                count={allocations.length}
                isEmpty={allocations.length === 0}
                emptyTitle="Sin descuentos asignados."
                actions={!isPosted ? <Section.Action text="Asignar" icon={Link2} variant="outline" onClick={() => setOpen(true)} /> : undefined}
            >
                {allocations.map((a) => (
                    <Section.Row
                        key={a.id}
                        title={a.movement_display_id}
                        description={Number(a.interest_part) > 0 ? `Capital ${a.principal_part} · Interés ${a.interest_part}` : undefined}
                        value={<MoneyDisplay amount={a.amount} />}
                        actions={!isPosted ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemove(a)}
                                disabled={busy === a.id}
                                aria-label="Quitar"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        ) : undefined}
                    />
                ))}
            </Section>

            {capWarning && (
                <p role="status" className="mt-2 flex items-start gap-2 text-sm text-warning-text">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{capWarning}
                </p>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                icon={Link2}
                title="Asignar a la liquidación"
                description="Anticipos y préstamos vigentes del empleado. La cuota se puede editar."
                footer={<FormFooter actions={<CancelButton onClick={() => setOpen(false)} />} />}
            >
                <div className="px-6 pb-4 pt-2 min-h-[80px] space-y-2">
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Cargando…</p>
                    ) : isError ? (
                        <p role="alert" className="text-sm text-destructive">No se pudieron cargar los movimientos.</p>
                    ) : pending.length === 0 ? (
                        <EmptyState variant="compact" title="Sin movimientos pendientes" description="El empleado no tiene anticipos ni préstamos con saldo." />
                    ) : pending.map((mv) => (
                        <div key={mv.id} data-testid="pending-movement" className="flex items-end justify-between gap-3 rounded-sm border px-3 py-2 text-sm">
                            <div className="flex flex-col gap-1">
                                <span className="font-medium">{mv.display_id}</span>
                                <span className="text-xs text-muted-foreground">{mv.kind_display} · saldo <MoneyDisplay amount={mv.balance} /></span>
                                <StatusBadge status={mv.status} label={mv.status_display} size="sm" />
                            </div>
                            <LabeledInput
                                label={mv.kind === "LOAN" ? "Cuota" : "Monto"}
                                type="number"
                                value={amounts[mv.id] ?? suggestedAmount(mv)}
                                onChange={(e) => setAmounts((prev) => ({ ...prev, [mv.id]: e.target.value }))}
                                containerClassName="w-32"
                            />
                            <SubmitButton type="button" size="sm" className="h-control-xs rounded-sm text-xs" onClick={() => handleAssign(mv)} loading={busy === mv.id}>
                                Asignar
                            </SubmitButton>
                        </div>
                    ))}
                </div>
            </BaseModal>
        </>
    )
}
