import type { ActionRegistry } from "@/types/actions"
import { FileText, RotateCcw, Trash2, Eye, FileEdit, Ban, CreditCard, Landmark } from "lucide-react"

/**
 * Payment Action Registry
 * Defines all available actions for payments/treasury movements
 */
interface PaymentDoc {
    id: number
    status?: string
    movement_type?: string
    display_id?: string
    amount?: number
    [key: string]: unknown
}

export const paymentActions: ActionRegistry<PaymentDoc> = {
    treasury: {
        id: "treasury",
        label: "Tesorería",
        icon: Landmark,
        actions: [
            {
                id: "annul-payment",
                label: "Anular Pago",
                icon: Ban,
                requiredPermissions: ["treasury.annul_treasurymovement"],
                checkAvailability: (payment) => {
                    if (!payment) return false
                    return payment.status === "POSTED"
                },
                variant: "destructive",
                excludedStatus: ["PENDING", "RECONCILED"],
            },
            {
                id: "return-payment",
                label: "Devolver Pago",
                icon: RotateCcw,
                requiredPermissions: ["treasury.add_treasurymovement"],
                checkAvailability: (payment) => {
                    if (!payment) return false
                    return payment.status === "POSTED" && payment.movement_type === "INBOUND"
                },
                excludedStatus: ["PENDING", "RECONCILED", "OUTBOUND"],
            },
            {
                id: "cancel-payment",
                label: "Cancelar Pago",
                icon: Trash2,
                requiredPermissions: ["treasury.cancel_treasurymovement"],
                checkAvailability: (payment) => {
                    if (!payment) return false
                    return payment.status !== "RECONCILED"
                },
                variant: "destructive",
                excludedStatus: ["RECONCILED"],
            },
            {
                id: "view-payment",
                label: "Ver Pago",
                icon: Eye,
                requiredPermissions: ["treasury.view_treasurymovement"],
                checkAvailability: () => true,
            },
        ],
    },
}