"use client"

import { useState } from "react"
import { MoneyDisplay } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface BankMastheadProps {
    data: BankOverviewData
}

export function BankMasthead({ data }: BankMastheadProps) {
    const { accounts, summary } = data
    const [deudaHovered, setDeudaHovered] = useState(false)

    const checking = accounts.filter(a => a.account_type === "CHECKING")
    const totalCash = checking.reduce((s, a) => s + a.current_balance, 0)
    const totalCreditLines = checking.reduce((s, a) => s + (a.credit_line_credit_limit ?? 0), 0)
    const totalDebt = summary.card_debt + summary.issued_checks + summary.total_loan_debt
    const netPosition = totalCash + totalCreditLines - totalDebt

    const showDeuda = () => setDeudaHovered(true)
    const hideDeuda = () => setDeudaHovered(false)

    return (
        <section className="py-4 space-y-3">
            <div>
                <div className="flex items-center gap-4 text-sm border-y border-border/40 py-2">
                    <Metric label="Saldo" value={totalCash} />
                    <Divider />
                    <Metric label="Línea de Crédito" value={totalCreditLines} />
                    <Divider />
                    <span
                        onMouseEnter={showDeuda}
                        onMouseLeave={hideDeuda}
                        className="cursor-pointer text-warning"
                    >
                        <Metric label="Deuda" value={totalDebt} />
                    </span>
                    <Divider />
                    <span className={cn(
                        "flex items-baseline gap-1.5",
                        netPosition >= 0 ? "text-success" : "text-destructive"
                    )}>
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Posición</span>
                        <MoneyDisplay amount={netPosition} showColor={false} className="text-sm font-heading font-black tracking-tight" />
                    </span>
                </div>

                {deudaHovered && (
                    <div
                        onMouseEnter={showDeuda}
                        onMouseLeave={hideDeuda}
                        className="flex items-center gap-4 text-sm text-warning"
                    >
                        <span className="flex items-baseline gap-1.5">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Préstamos</span>
                            <span className="text-warning">{summary.active_loan_count}</span>
                            {" · "}
                            <MoneyDisplay amount={summary.total_loan_debt} className="text-sm font-heading font-black tracking-tight" />
                        </span>
                        <Divider />
                        <span className="flex items-baseline gap-1.5">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cheques</span>
                            <MoneyDisplay amount={summary.issued_checks} className="text-sm font-heading font-black tracking-tight" />
                        </span>
                        <Divider />
                        <span className="flex items-baseline gap-1.5">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Deuda TC</span>
                            <MoneyDisplay amount={summary.card_debt} className="text-sm font-heading font-black tracking-tight" />
                            {" · "}
                            <span className="text-warning">{summary.card_count ?? 0} tarjeta(s)</span>
                        </span>
                    </div>
                )}
            </div>
        </section>
    )
}

function Metric({ label, value }: { label: string; value: number; accent?: boolean }) {
    return (
        <span className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <MoneyDisplay amount={value} showColor={false} className="text-sm font-heading font-black tracking-tight" />
        </span>
    )
}

function Divider() {
    return <span className="text-border/50 select-none">|</span>
}


