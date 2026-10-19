"use client"

import { Building2 } from "lucide-react"
import { toNumber } from "@/components/entity-view"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { TerminalBatch } from "../types"

/** Feature extension: provider name (bold, with icon) + payment method below. */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        terminalBatchProvider: { value: TerminalBatch; options: Record<never, never> }
    }
}

function TerminalBatchProviderCell({ value: batch }: ValueRenderProps<"terminalBatchProvider">) {
    return (
        <div className="flex flex-col items-center">
            <span className="font-bold flex items-center justify-center gap-1.5 text-center w-full">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                {batch.provider_name}
            </span>
            <span className="text-3xs text-muted-foreground uppercase tracking-wide text-center">
                {batch.payment_method_name} (Depósito)
            </span>
        </div>
    )
}

let registered = false
function registerTerminalBatchValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("terminalBatchProvider", {
        format: (b) => b.provider_name ?? "",
        render: TerminalBatchProviderCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerTerminalBatchValueKinds()

/** Terminal (POS) settlement batches (ADR-0087 oleada C1). Replaces terminalBatchFields.tsx (2 computed). */
export const terminalBatchEntity = defineEntity<TerminalBatch>()((f) => ({
    label: "treasury.terminalbatch",
    fields: {
        salesDate: f.dateRange((b) => ({ from: b.sales_date ?? "", to: b.sales_date_end ?? null }), { label: "Fecha Venta" }),
        transactionCount: f.number("transaction_count", { label: "Transacciones" }),
        provider: f.value("terminalBatchProvider", (b) => b, { label: "Proveedor" }),
        netAmount: f.money("net_amount", { label: "Depósito Neto" }),
        commissionTotal: f.money((b) => (b.commission_total ? -Math.abs(toNumber(b.commission_total) ?? 0) : 0), { label: "Comisión" }),
        status: f.status((b) => (b.is_settled ? { status: "settled", label: "Liquidado" } : { status: "pending", label: "Pendiente" }), { label: "Estado" }),
    },
}))

export const terminalBatchViews = terminalBatchEntity.views({
    table: { columns: ["salesDate", "provider", "transactionCount", "netAmount", "commissionTotal", "status"], primary: "provider" },
    card: {
        title: "provider",
        subtitle: ["salesDate"],
        trailing: ["netAmount"],
        meta: ["transactionCount", "commissionTotal", "status"],
    },
})
