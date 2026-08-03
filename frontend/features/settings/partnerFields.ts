import { createEntityFields } from "@/components/shared"
import type { Partner } from "@/features/contacts"
import { cn } from "@/lib/utils"

export const partnerFields = createEntityFields<Partner>()({
    equityPercentage: {
        key: "partner_equity_percentage",
        type: "number",
        label: "Part. %",
        suffix: () => "%",
        weight: "bold",
    },
    totalContributions: {
        key: "partner_total_contributions",
        type: "currency",
        label: "C. Suscrito",
        tableOptions: { align: "right" },
        weight: "bold",
    },
    totalPaidIn: {
        key: "partner_total_paid_in",
        type: "currency",
        label: "C. Enterado",
        tableOptions: { align: "right" },
        weight: "black",
        intent: "success",
    },
    pendingCapital: {
        key: "partner_pending_capital",
        type: "currency",
        label: "Pendiente",
        className: (val) => cn(
            (val as number) > 0 ? "text-warning" : "text-muted-foreground/30"
        ),
    },
    provisionalWithdrawals: {
        key: "partner_provisional_withdrawals_balance",
        type: "currency",
        label: "R. Provisorios",
        showZeroAsDash: (val) => val <= 0,
        className: (val) => cn(
            (val as number) > 0 ? "text-destructive" : "text-muted-foreground/30"
        ),
    },
    earningsBalance: {
        key: "partner_earnings_balance",
        type: "currency",
        label: "Utilidades",
        showZeroAsDash: (val) => val <= 0,
        className: (val) => cn(
            (val as number) > 0 ? "text-success" : "text-muted-foreground/30"
        ),
    },
    dividendsPayable: {
        key: "partner_dividends_payable_balance",
        type: "currency",
        label: "D. por Pagar",
        showZeroAsDash: (val) => val <= 0,
        className: (val) => cn(
            (val as number) > 0 ? "text-warning" : "text-muted-foreground/30"
        ),
    },
    netEquity: {
        key: "partner_net_equity",
        type: "currency",
        label: "Patrimonio",
        tableOptions: { align: "right" },
        weight: "black",
        size: "md",
    },
})
