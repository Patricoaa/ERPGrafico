"use client"

import { useRouter } from "next/navigation"
import { Landmark, CreditCard, Wallet } from "lucide-react"
import { MoneyDisplay, EmptyState } from "@/components/shared"
import { useBranding } from "@/contexts/BrandingProvider"
import { cn } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface BankAccountsSectionProps {
    data: BankOverviewData
    bankId: number
}

function formatCardNumber(value: string | null | undefined): string {
    if (!value) return "\u2014"
    const clean = value.replace(/\D/g, "")
    const groups = clean.match(/.{1,4}/g)
    return groups ? groups.join(" ") : value
}

const GRADIENTS = [
    "from-primary to-primary/70",
    "from-[var(--info)] to-[var(--info)]/70",
    "from-[var(--magenta)] to-[var(--magenta)]/70",
]

export function BankAccountsSection({ data, bankId }: BankAccountsSectionProps) {
    const router = useRouter()
    const { company } = useBranding()
    const companyName = company?.trade_name || company?.name || ""

    const checking = data.accounts.filter(a => a.account_type === "CHECKING")
    const cards = data.accounts.filter(a => a.account_type === "CREDIT_CARD")

    const hasChecking = checking.length > 0
    const hasCards = cards.length > 0

    if (!hasChecking && !hasCards) return null

    const colClass = hasChecking && hasCards
        ? "grid-cols-1 lg:grid-cols-[1fr_380px]"
        : "grid-cols-1"

    return (
        <section className="py-4">
            <div className={cn("grid gap-5", colClass)}>
                {hasChecking && (
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Landmark className="h-3 w-3" />
                            Cuentas Corrientes
                        </h2>
                        <div className="divide-y divide-border/40 -my-0.5">
                            {checking.map(acc => {
                                const creditLine = acc.credit_line_credit_limit ?? 0
                                const available = creditLine > 0
                                    ? Math.max(0, acc.current_balance + creditLine)
                                    : acc.current_balance
                                return (
                                    <button
                                        key={acc.id}
                                        onClick={() => router.push(`/treasury/bank-center/${bankId}/movements?account=${acc.id}`)}
                                        className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-sm px-1 -mx-1"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <span className="text-sm font-medium truncate">{acc.name}</span>
                                                {acc.account_number && (
                                                    <span className="text-[11px] font-mono text-muted-foreground truncate">
                                                        {acc.account_number}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-baseline gap-3 text-xs shrink-0">
                                            {creditLine > 0 && (
                                                <span className="text-muted-foreground">
                                                    Línea <MoneyDisplay amount={creditLine} className="text-xs font-semibold" showColor={false} />
                                                </span>
                                            )}
                                            <span>
                                                <MoneyDisplay amount={acc.current_balance} className="text-xs font-bold" />
                                            </span>
                                            <span className="font-semibold text-muted-foreground">
                                                Disp. <MoneyDisplay amount={available} className="text-xs font-semibold" showColor={available >= 0} />
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {hasCards && (
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                            <CreditCard className="h-3 w-3" />
                            Tarjetas de Crédito
                        </h2>
                        <div className="space-y-3">
                            {cards.map((card, idx) => {
                                const available = card.credit_limit != null
                                    ? card.credit_limit - Math.abs(card.current_balance)
                                    : null
                                return (
                                    <button
                                        key={card.id}
                                        onClick={() => router.push(`/treasury/bank-center/${bankId}/cards/unbilled?card=${card.id}`)}
                                        className={cn(
                                            "relative w-full rounded-xl bg-gradient-to-br p-4 text-white shadow-lg overflow-hidden text-left transition-all hover:brightness-110",
                                            GRADIENTS[idx % GRADIENTS.length]
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                        <div className="w-8 h-6 rounded bg-warning/30 flex items-center justify-center">
                                            <div className="w-6 h-4 rounded border border-warning/50" />
                                            </div>
                                            <CreditCard className="h-4 w-4 opacity-60" />
                                        </div>
                                        <div className="font-mono text-sm tracking-widest mb-3">
                                            {formatCardNumber(card.card_number || card.account_number || card.code)}
                                        </div>
                                        <div className="text-[10px] opacity-70 mb-0.5">Titular</div>
                                        <div className="text-sm font-medium mb-3">{companyName}</div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div>
                                                <div className="opacity-70 mb-0.5">Cupo</div>
                                                <div className="font-semibold">
                                                    <MoneyDisplay amount={card.credit_limit || 0} showColor={false} className="text-white" />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="opacity-70 mb-0.5">Utilizado</div>
                                                <div className="font-semibold">
                                                    <MoneyDisplay amount={Math.abs(card.current_balance)} showColor={false} className="text-white" />
                                                </div>
                                            </div>
                                            {available != null && (
                                                <div className="text-right">
                                                    <div className="opacity-70 mb-0.5">Disponible</div>
                                                    <div className="font-semibold">
                                                        <MoneyDisplay amount={available} showColor={false} className="text-white" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
