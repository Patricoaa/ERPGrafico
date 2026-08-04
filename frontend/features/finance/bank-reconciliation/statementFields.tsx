import { createEntityFields } from "@/components/shared"
import type { BankStatement } from "./types"
import { Progress } from "@/components/ui/progress"

export const statementFields = createEntityFields<BankStatement>()({
    display_id: { key: "display_id", type: "code", label: "Folio" },
    treasury_account_name: { key: "treasury_account_name", type: "secondary", label: "Cuenta" },
    statement_date: { key: "statement_date", type: "date", label: "Fecha" },
    opening_balance: {
        key: "opening_balance",
        type: "currency",
        label: "Apertura",
        intent: "muted",
        tableOptions: { align: "right" },
    },
    closing_balance: {
        key: "closing_balance",
        type: "currency",
        label: "Cierre",
        tableOptions: { align: "right" },
    },
    linesInfo: {
        key: "total_lines",
        type: "computed",
        label: "Líneas",
        render: (e) => (
            <div className="flex flex-col items-center justify-center w-full">
                <span className="font-semibold text-xs">{e.total_lines} total</span>
                <span className="text-xs text-muted-foreground">
                    {e.reconciled_lines} rec.
                </span>
            </div>
        ),
    },
    reconciliation_progress: {
        key: "reconciliation_progress",
        type: "computed",
        label: "Progreso",
        render: (e) => {
            const progress = e.reconciliation_progress
            return (
                <div className="flex items-center justify-center gap-2 min-w-[120px] w-full">
                    <Progress value={progress} className="h-1.5 w-16" />
                    <span className="text-xs font-mono font-bold w-10 text-right">
                        {Math.round(progress)}%
                    </span>
                </div>
            )
        },
    },
    state: { key: "state", type: "status", label: "Estado", getLabel: (e) => e.state_display },
})
