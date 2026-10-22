import { defineEntity } from "@/components/entity-view"
import type { Payroll } from "@/types/hr"

export const payrollEntity = defineEntity<Payroll>()((f) => ({
    title: "Liquidación",
    rowId: (p) => String(p.id),
    fields: {
        displayId: f.code((p) => p.display_id, { label: "Folio" }),
        period: f.text((p) => p.period_label, { label: "Período" }),
        haberes: f.money((p) => Number(p.total_haberes), { label: "Haberes" }),
        descuentos: f.flow((p) => Number(p.total_descuentos), { label: "Descuentos", direction: "outflow" }),
        netSalary: f.money((p) => Number(p.net_salary), { label: "Líquido" }),
        remuStatus: f.status(
            (p) => p.remuneration_paid_status ? { status: p.remuneration_paid_status } : null,
            { label: "Pago" },
        ),
    },
}))

export const payrollViews = payrollEntity.views({
    table: { columns: ["displayId", "period", "haberes", "descuentos", "netSalary", "remuStatus"] },
})
