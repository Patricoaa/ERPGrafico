import { createEntityFields } from "@/components/shared"
import type { TaxPeriod } from "./types"

export const taxPeriodFields = createEntityFields<TaxPeriod>()({
    period_display: { 
        key: "period_display", 
        type: "text", 
        label: "Período",
        getValue: (e) => `${e.month_display} ${e.year}`
    },
    status: { 
        key: "status", 
        type: "status", 
        label: "Estado",
    },
    vat_to_pay: { 
        key: "vat_to_pay", 
        type: "currency", 
        label: "Impuesto Determinado",
        getValue: (e) => e.declaration_summary?.vat_to_pay || 0
    },
    payment_status: {
        key: "payment_status",
        type: "status",
        label: "Estado Pago",
        getValue: (e) => {
            const summary = e.declaration_summary
            if (!summary) return 'PENDING' // fallback
            if (summary.is_fully_paid) return 'PAID'
            if (summary.vat_to_pay > 0 && e.status === 'CLOSED') return 'VOIDED'
            return 'PENDING'
        },
        getLabel: (e) => {
            const summary = e.declaration_summary
            if (!summary) return '-'
            if (summary.is_fully_paid) return 'Pagado'
            if (summary.vat_to_pay > 0 && e.status === 'CLOSED') return 'Pendiente'
            return '-'
        }
    }
})
