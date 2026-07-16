import { createEntityFields } from "@/components/shared"
import type { TaxPeriod } from "./types"

export const taxPeriodFields = createEntityFields<TaxPeriod>()({
    period_display: { 
        key: "month_display", 
        type: "text", 
        label: "Período",
        get: (e: TaxPeriod) => `${e.month_display} ${e.year}`
    },
    status: { 
        key: "status", 
        type: "status", 
        label: "Estado",
    },
    vat_to_pay: { 
        key: "id", // Use an existing key for computed
        type: "currency", 
        label: "Impuesto Determinado",
        get: (e: TaxPeriod) => e.declaration_summary?.vat_to_pay || 0
    },
    payment_status: {
        key: "year", 
        type: "status",
        label: "Estado Pago",
        get: (e: TaxPeriod) => {
            const summary = e.declaration_summary
            if (!summary) return 'PENDING' // fallback
            if (summary.is_fully_paid) return 'PAID'
            if (summary.vat_to_pay > 0 && e.status === 'CLOSED') return 'VOIDED'
            return 'PENDING'
        },
        getLabel: (e: TaxPeriod) => {
            const summary = e.declaration_summary
            if (!summary) return '-'
            if (summary.is_fully_paid) return 'Pagado'
            if (summary.vat_to_pay > 0 && e.status === 'CLOSED') return 'Pendiente'
            return '-'
        }
    }
})
