"use client"

import { useRouter } from "next/navigation"
import { HandCoins } from "lucide-react"
import { MoneyDisplay, SectionHeader } from "@/components/shared"
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
            <SectionHeader
                icon={HandCoins}
                title="Préstamos Bancarios"
                count={active_loans.length}
                href={`/treasury/bank-center/${bankId}/loans`}
                variant="card"
            />

            <div className="space-y-2">
                {active_loans.map(loan => (
                    <button
                        key={loan.id}
                        onClick={() => router.push(`/treasury/bank-center/${bankId}/loans?selected=${loan.id}`)}
                        className="card-base w-full text-left bg-card p-4 cursor-pointer"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold truncate">{loan.display_id}</span>
                            <HandCoins className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                        </div>

                        <div className="text-[11px] font-mono text-muted-foreground mb-3">
                            Vigente
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
                            <div>
                                <span className="text-[10px] text-muted-foreground block">Capital</span>
                                <MoneyDisplay amount={loan.principal} className="text-sm font-semibold" showColor={false} />
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-muted-foreground block">Saldo Insoluto</span>
                                <MoneyDisplay amount={loan.outstanding_balance} className="text-sm font-semibold" />
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-muted-foreground block">Cuotas Rest.</span>
                                <span className="text-sm font-semibold tabular-nums">
                                    {loan.paid_installments_count}/{loan.installments_count}
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    )
}
