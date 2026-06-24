"use client"

import { useRouter } from "next/navigation"
import { Landmark, Wallet, ArrowRight } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankOverviewCheckingCards({ data, bankId }: Props) {
    const router = useRouter()
    const checking = data.accounts.filter(a => a.account_type === "CHECKING")

    if (checking.length === 0) return null

    return (
        <section>
            <button
                onClick={() => router.push(`/treasury/bank-center/${bankId}/movements`)}
                className="w-full flex items-center justify-between group mb-3"
            >
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Landmark className="h-3 w-3" />
                    Cuentas Corrientes
                    <span className="font-normal text-border/60 mx-1">·</span>
                    <span className="font-normal">{checking.length}</span>
                </h2>
                <span className="text-[10px] font-medium text-muted-foreground/0 group-hover:text-muted-foreground transition-all flex items-center gap-0.5">
                    Ver todas <ArrowRight className="h-3 w-3" />
                </span>
            </button>

            <div className="space-y-2">
                {checking.map(acc => {
                    const creditLine = acc.credit_line_credit_limit ?? 0
                    const available = creditLine > 0
                        ? Math.max(0, acc.current_balance + creditLine)
                        : acc.current_balance
                    const isPositive = acc.current_balance >= 0

                    return (
                        <button
                            key={acc.id}
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/movements?account=${acc.id}`)}
                            className={cn(
                                "w-full text-left rounded-lg border border-border/50 bg-card p-3",
                                "hover:bg-accent hover:border-border transition-all",
                                "border-l-4",
                                isPositive ? "border-l-success" : "border-l-destructive",
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-semibold truncate">{acc.name}</span>
                                {acc.account_number && (
                                    <span className="text-[10px] font-mono text-muted-foreground truncate">
                                        ···{acc.account_number.slice(-4)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                                <div>
                                    <span className="text-[10px] text-muted-foreground block">Saldo</span>
                                    <MoneyDisplay amount={acc.current_balance} className="text-sm font-bold" />
                                </div>
                                {creditLine > 0 && (
                                    <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground block">Línea</span>
                                        <MoneyDisplay amount={creditLine} className="text-xs font-semibold" showColor={false} />
                                    </div>
                                )}
                                <div className="text-right">
                                    <span className="text-[10px] text-muted-foreground block">Disponible</span>
                                    <MoneyDisplay amount={available} className="text-xs font-semibold" showColor={available >= 0} />
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
