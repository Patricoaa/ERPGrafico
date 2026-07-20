import { createEntityFields } from "@/components/shared"
import type { Partner } from "@/features/contacts"
import { cn } from "@/lib/utils"

export const partnerFields = createEntityFields<Partner>()({
    equityPercentage: {
        key: "partner_equity_percentage",
        type: "text",
        label: "Part. %",
        suffix: () => "%",
    },
    totalContributions: {
        key: "partner_total_contributions",
        type: "currency",
        label: "C. Suscrito",
        tableOptions: { align: "right" },
        cellProps: { className: "text-right font-mono text-[11px] font-bold opacity-80" },
    },
    totalPaidIn: {
        key: "partner_total_paid_in",
        type: "currency",
        label: "C. Enterado",
        tableOptions: { align: "right" },
        cellProps: { className: "text-right font-mono text-[11px] font-black text-success" },
    },
    pendingCapital: {
        key: "partner_pending_capital",
        type: "currency",
        label: "Pendiente",
        get: (p) => {
            const val = parseFloat(p.partner_pending_capital as string)
            return val
        },
        className: (val) => cn(
            "text-right font-mono text-[11px] font-bold",
            (val as number) > 0 ? "text-warning" : "text-muted-foreground/30"
        ),
    },
    provisionalWithdrawals: {
        key: "partner_provisional_withdrawals_balance",
        type: "currency",
        label: "R. Provisorios",
        get: (p) => {
            const val = parseFloat(p.partner_provisional_withdrawals_balance as string)
            return val > 0 ? val : 0
        },
        showZeroAsDash: (val) => val <= 0,
        className: (val) => cn(
            "text-right font-mono text-[11px] font-bold",
            (val as number) > 0 ? "text-destructive" : "text-muted-foreground/30"
        ),
    },
    earningsBalance: {
        key: "partner_earnings_balance",
        type: "currency",
        label: "Utilidades",
        get: (p) => {
            const val = parseFloat(p.partner_earnings_balance as string)
            return val > 0 ? val : 0
        },
        showZeroAsDash: (val) => val <= 0,
        className: (val) => cn(
            "text-right font-mono text-[11px] font-bold",
            (val as number) > 0 ? "text-success" : "text-muted-foreground/30"
        ),
    },
    dividendsPayable: {
        key: "partner_dividends_payable_balance",
        type: "currency",
        label: "D. por Pagar",
        get: (p) => {
            const val = parseFloat(p.partner_dividends_payable_balance as string)
            return val > 0 ? val : 0
        },
        showZeroAsDash: (val) => val <= 0,
        className: (val) => cn(
            "text-right font-mono text-[11px] font-bold",
            (val as number) > 0 ? "text-warning" : "text-muted-foreground/30"
        ),
    },
    netEquity: {
        key: "partner_net_equity",
        type: "currency",
        label: "Patrimonio",
        tableOptions: { align: "right" },
        cellProps: { className: "text-right font-mono text-[12px] font-black" },
    },
}, {
    title: { field: 'name' },
})
