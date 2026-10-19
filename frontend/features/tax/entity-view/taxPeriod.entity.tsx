"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import type { TaxPeriod } from "../types"

/** Feature extension: the "year box + month" period badge. Single consumer, lives with its entity. */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        taxPeriod: { value: TaxPeriod; options: Record<never, never> }
    }
}

function TaxPeriodCell({ value: period }: ValueRenderProps<"taxPeriod">) {
    return (
        <div className="flex items-center justify-center gap-3 w-full">
            <div className="w-10 h-10 rounded-sm bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                <span className="text-4xs font-bold text-primary/60">{period.year}</span>
                <span className="text-xs font-bold text-primary">{period.month_display?.substring(0, 3)}</span>
            </div>
            <DataCell.Text>{period.month_display || ''} {period.year}</DataCell.Text>
        </div>
    )
}

let registered = false
function registerTaxPeriodValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("taxPeriod", {
        format: (p) => `${p.month_display ?? ''} ${p.year}`.trim(),
        // Chronological, not alphabetical: "Enero" must sort before "Febrero" regardless of year digit order.
        sortValue: (p) => p.year * 100 + p.month,
        align: "center",
        render: TaxPeriodCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerTaxPeriodValueKinds()

/** Tax periods / F29 declarations (ADR-0087 oleada B2). Replaces taxPeriodFields.tsx (2 computed). */
export const taxPeriodEntity = defineEntity<TaxPeriod>()((f) => ({
    label: "tax.taxperiod",
    fields: {
        period: f.value("taxPeriod", (p) => p, { label: "Período" }),
        status: f.status((p) => ({ status: p.status, label: p.status_display }), { label: "Estado" }),
        vatToPay: f.money((p) => p.declaration_summary?.vat_to_pay ?? 0, { label: "Impuesto Determinado" }),
        paymentStatus: f.status((p) => {
            const summary = p.declaration_summary
            if (!summary) return null
            if (summary.is_fully_paid) return { status: "PAID", label: "Pagado" }
            if (summary.vat_to_pay > 0 && p.status === "CLOSED") return { status: "VOIDED", label: "Pendiente" }
            return null
        }, { label: "Estado Pago" }),
    },
}))

export const taxPeriodViews = taxPeriodEntity.views({
    table: { columns: ["period", "status", "vatToPay", "paymentStatus"], primary: "period" },
    card: {
        // Card title is plain text (the kind's compact year/month box only renders in the table cell).
        title: "period",
        trailing: ["status"],
        meta: ["vatToPay", "paymentStatus"],
    },
})
