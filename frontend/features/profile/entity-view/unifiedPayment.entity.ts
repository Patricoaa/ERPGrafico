import { defineEntity } from "@/components/entity-view"

export type UnifiedPayment = {
    id: string
    date: string
    type: "ANTICIPO" | "SALARIO" | "PREVIRED"
    typeLabel: string
    amount: string
    payroll_display_id: string | null
    statusKey: string
}

export const unifiedPaymentEntity = defineEntity<UnifiedPayment>()((f) => ({
    title: "Pago",
    rowId: (p) => p.id,
    fields: {
        date: f.date((p) => p.date, { label: "Fecha" }),
        typeLabel: f.text((p) => p.typeLabel, { label: "Tipo" }),
        amount: f.money((p) => p.amount, { label: "Monto" }),
        statusKey: f.status((p) => ({ status: p.statusKey }), { label: "Estado" }),
    },
}))

export const unifiedPaymentViews = unifiedPaymentEntity.views({
    table: { columns: ["date", "typeLabel", "amount", "statusKey"] },
})
