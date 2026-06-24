"use client"

import { useRouter } from "next/navigation"
import { HandCoins, ArrowRight } from "lucide-react"
import { MoneyDisplay, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankOverviewLoanCards({ data, bankId }: Props) {
    const router = useRouter()
    const { active_loans } = data

    if (active_loans.length === 0) return null

    return (
        <section>
            <button
                onClick={() => router.push(`/treasury/bank-center/${bankId}/loans`)}
                className="w-full flex items-center justify-between group mb-3"
            >
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <HandCoins className="h-3 w-3" />
                    Préstamos Bancarios
                    <span className="font-normal text-border/60 mx-1">·</span>
                    <span className="font-normal">{active_loans.length}</span>
                </h2>
                <span className="text-[10px] font-medium text-muted-foreground/0 group-hover:text-muted-foreground transition-all flex items-center gap-0.5">
                    Ver todos <ArrowRight className="h-3 w-3" />
                </span>
            </button>

            <div className="space-y-2">
                {active_loans.map(loan => {
                    const pct = loan.installments_count > 0
                        ? Math.round((loan.paid_installments_count / loan.installments_count) * 100)
                        : 0

                    return (
                        <button
                            key={loan.id}
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/loans?selected=${loan.id}`)}
                            className="w-full text-left rounded-lg border border-border/50 bg-card p-3 border-l-4 border-l-info hover:bg-accent hover:border-border transition-all"
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-semibold truncate">{loan.display_id}</span>
                                    {loan.loan_number && (
                                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                                            {loan.loan_number}
                                        </span>
                                    )}
                                </div>
                                <StatusBadge status="ACTIVE" label="Vigente" className="text-[10px] shrink-0" />
                            </div>

                            <div className="flex items-baseline gap-4 text-xs mb-2">
                                <div>
                                    <span className="text-[10px] text-muted-foreground block">Capital</span>
                                    <MoneyDisplay amount={loan.principal} className="text-xs font-semibold" showColor={false} />
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground block">Saldo Insoluto</span>
                                    <MoneyDisplay amount={loan.outstanding_balance} className="text-xs font-bold" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-success" : "bg-info")}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {loan.paid_installments_count}/{loan.installments_count}
                                </span>
                            </div>

                            {loan.next_due_date && (
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/40">
                                    <span>Próx. vencimiento: {new Date(loan.next_due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    {loan.next_installment_amount != null && (
                                        <MoneyDisplay amount={loan.next_installment_amount} className="text-[10px] font-semibold" showColor={false} />
                                    )}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
