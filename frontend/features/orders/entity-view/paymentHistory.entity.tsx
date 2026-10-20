"use client"

import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { User, FileText, Hash } from "lucide-react"

// ─── paymentDate: date + optional created-by line ────────────────────────────

export interface PaymentDateValue { date: string; createdBy?: string | null }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        paymentDate: { value: PaymentDateValue | null; options: Record<never, never> }
    }
}

function PaymentDateCell({ value }: ValueRenderProps<"paymentDate">) {
    if (!value) return null
    return (
        <div className="flex flex-col gap-0.5">
            <DataCell.Date value={value.date} />
            {value.createdBy && (
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {value.createdBy}
                </span>
            )}
        </div>
    )
}

registerValueKind("paymentDate", {
    format: (v) => v?.date ?? "",
    render: PaymentDateCell,
})

// ─── paymentRef: reference / transaction_number / fallback ───────────────────

export interface PaymentRefValue { reference?: string | null; transactionNumber?: string | null }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        paymentRef: { value: PaymentRefValue | null; options: Record<never, never> }
    }
}

function PaymentRefCell({ value }: ValueRenderProps<"paymentRef">) {
    if (!value || (!value.reference && !value.transactionNumber)) {
        return <span className="text-xs text-muted-foreground italic">Sin referencias</span>
    }
    return (
        <div className="flex flex-col gap-1">
            {value.reference && (
                <span className="text-xs font-medium flex items-center gap-1">
                    <FileText className="h-3 w-3 text-muted-foreground" /> {value.reference}
                </span>
            )}
            {value.transactionNumber && (
                <span className="text-xs font-bold text-success flex items-center gap-1">
                    <Hash className="h-3 w-3" /> {value.transactionNumber}
                </span>
            )}
        </div>
    )
}

registerValueKind("paymentRef", {
    format: (v) => v?.reference ?? v?.transactionNumber ?? "",
    render: PaymentRefCell,
})

// ─── paymentMethod: primary-tinted chip ──────────────────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        paymentMethod: { value: string | null | undefined; options: Record<never, never> }
    }
}

function PaymentMethodCell({ value }: ValueRenderProps<"paymentMethod">) {
    if (!value) return null
    return <DataCell.Chip intent="primary">{value}</DataCell.Chip>
}

registerValueKind("paymentMethod", {
    format: (v) => v ?? "",
    render: PaymentMethodCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface PaymentEntry {
    id: number
    amount: number
    payment_method: string
    payment_method_display: string
    date: string
    reference?: string | null
    transaction_number?: string | null
    created_by_name?: string | null
}

const fixed = { sortable: false } as const

export const paymentHistoryEntity = defineEntity<PaymentEntry>()((f) => ({
    title: "Historial de pagos",
    rowId: (r) => r.id,
    fields: {
        date: f.value("paymentDate", (r) => ({ date: r.date, createdBy: r.created_by_name }), { ...fixed, label: "Fecha" }),
        method: f.value("paymentMethod", (r) => r.payment_method_display || r.payment_method, { ...fixed, label: "Método de Pago" }),
        reference: f.value("paymentRef", (r) => ({ reference: r.reference, transactionNumber: r.transaction_number }), { ...fixed, label: "Referencia / N° Op" }),
        amount: f.money("amount", { ...fixed, label: "Monto" }),
    },
}))

export const paymentHistoryViews = paymentHistoryEntity.views({
    table: { columns: ["date", "method", "reference", "amount"], footer: { sum: ["amount"] } },
})
