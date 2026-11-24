"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PaymentModal } from "@/features/treasury"
import { useEmployeeMovementMutations } from "../hooks/useEmployeeMovementMutations"
import { EmployeeMovementDrawer } from "./EmployeeMovementDrawer"

interface NewEmployeeMovementFlowProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employeeId: number
    initialKind: "ADVANCE" | "LOAN"
}

/** Crea un anticipo o préstamo de un empleado: formulario y luego el desembolso por tesorería. */
export function NewEmployeeMovementFlow({ open, onOpenChange, employeeId, initialKind }: NewEmployeeMovementFlowProps) {
    const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
    const [paying, setPaying] = useState(false)
    const { createMovement } = useEmployeeMovementMutations()
    const amount = payload ? parseFloat(String(payload.amount)) : 0

    return (
        <>
            <EmployeeMovementDrawer
                open={open}
                onOpenChange={onOpenChange}
                movement={null}
                fixedEmployeeId={employeeId}
                initialKind={initialKind}
                onSaved={(data) => { setPayload(data ?? null); setPaying(true) }}
            />
            <PaymentModal
                open={paying}
                onOpenChange={setPaying}
                title="Registrar desembolso"
                total={amount}
                pendingAmount={amount}
                isPurchase={true}
                hideDteFields={true}
                onConfirm={async (paymentData) => {
                    try {
                        await createMovement({
                            id: null,
                            payload: {
                                ...payload,
                                ...paymentData,
                                amount: String(payload?.amount ?? paymentData.amount),
                                date: String(paymentData.documentDate || payload?.date),
                            },
                        })
                        setPaying(false)
                        setPayload(null)
                    } catch (e: unknown) {
                        toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al registrar el movimiento")
                    }
                }}
            />
        </>
    )
}
