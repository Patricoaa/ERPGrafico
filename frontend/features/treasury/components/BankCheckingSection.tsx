"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Landmark, Wallet } from "lucide-react"
import { MoneyDisplay, SectionHeader } from "@/components/shared"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankCheckingSection({ data, bankId }: Props) {
    const router = useRouter()
    const checking = data.accounts.filter(a => a.account_type === "CHECKING")

    if (checking.length === 0) return null

    return (
        <section>
            <SectionHeader
                icon={Landmark}
                title="Cuentas Corrientes"
                count={checking.length}
                href={`/treasury/bank-center/${bankId}/movements`}
                variant="card"
            />

            <div className="space-y-2">
                {checking.map(acc => {
                    const creditLine = acc.credit_line_credit_limit ?? 0
                    const available = creditLine > 0
                        ? Math.max(0, acc.current_balance + creditLine)
                        : acc.current_balance

                    return (
                        <Button
                            key={acc.id}
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/movements?account=${acc.id}`)}
                            className="card-base w-full text-left bg-card p-4 cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold truncate">{acc.name}</span>
                                <Wallet className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                            </div>

                            <div className="text-[11px] font-mono text-muted-foreground mb-3">
                                {acc.account_number ?? acc.code ?? "—"}
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
                                <div>
                                    <span className="text-[10px] text-muted-foreground block">Saldo</span>
                                    <MoneyDisplay amount={acc.current_balance} className="text-sm font-semibold" />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-muted-foreground block">Línea</span>
                                    <MoneyDisplay amount={creditLine} className="text-sm font-semibold" showColor={false} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-muted-foreground block">Disponible</span>
                                    <MoneyDisplay amount={available} className="text-sm font-semibold" showColor={available >= 0} />
                                </div>
                            </div>
                        </Button>
                    )
                })}
            </div>
        </section>
    )
}
