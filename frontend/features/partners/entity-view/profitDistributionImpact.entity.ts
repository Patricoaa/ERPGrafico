import { defineEntity } from "@/components/entity-view"
import type { ProfitDistributionImpactPartner } from "@/features/contacts"

const fixed = { sortable: false } as const
const n = (v: string) => Number(v) || 0

/**
 * Proyección por socio al ejecutar una distribución (paso de impactos del wizard). Las columnas de
 * destino cambian entre utilidad y pérdida, por eso hay dos vistas.
 */
export const profitDistributionImpactEntity = defineEntity<ProfitDistributionImpactPartner>()((f) => ({
    title: "Impactos por socio",
    rowId: (r) => r.partner,
    fields: {
        partner: f.text((r) => r.partner_name, { ...fixed, label: "Socio" }),
        gross: f.money((r) => n(r.gross_amount), { ...fixed, label: "Bruto" }),
        offset: f.money((r) => n(r.provisional_withdrawals_offset), { ...fixed, label: "Retiros absorbidos" }),
        balanceAfter: f.money((r) => n(r.provisional_balance_after), { ...fixed, label: "Saldo retiros tras la distribución" }),
        net: f.money((r) => n(r.net_amount), { ...fixed, label: "Neto" }),
        dividend: f.money((r) => n(r.dividend), { ...fixed, label: "Dividendos" }),
        reinvest: f.money((r) => n(r.reinvest), { ...fixed, label: "Reinversión" }),
        retained: f.money((r) => n(r.retained), { ...fixed, label: "Retenido" }),
        loss: f.money((r) => n(r.loss), { ...fixed, label: "Pérdida absorbida" }),
        percentage: f.text(
            (r) => r.percentage_changes
                ? `${r.percentage_before}% → ${r.percentage_after}% (${(n(r.percentage_after) - n(r.percentage_before) > 0 ? "+" : "")}${(n(r.percentage_after) - n(r.percentage_before)).toFixed(2)})`
                : `${r.percentage_before}% (sin cambio)`,
            { ...fixed, label: "Participación" },
        ),
    },
}))

export const profitDistributionImpactViews = profitDistributionImpactEntity.views({
    table: { columns: ["partner", "gross", "offset", "balanceAfter", "net", "dividend", "reinvest", "retained", "percentage"] },
})

export const profitDistributionLossImpactViews = profitDistributionImpactEntity.views({
    table: { columns: ["partner", "gross", "net", "loss", "percentage"] },
})
