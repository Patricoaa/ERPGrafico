"use client"

import { useRouter } from "next/navigation"
import { CreditCard } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { useBranding } from "@/contexts/BrandingProvider"
import { cn } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
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

export function BankOverviewCreditCards({ data, bankId }: Props) {
    const router = useRouter()
    const { company } = useBranding()
    const companyName = company?.trade_name || company?.name || ""

    const cards = data.accounts.filter(a => a.account_type === "CREDIT_CARD")

    if (cards.length === 0) return null

    return (
        <section>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <CreditCard className="h-3 w-3" />
                Tarjetas de Crédito
                <span className="font-normal text-border/60 mx-1">·</span>
                <span className="font-normal">{cards.length}</span>
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
        </section>
    )
}
