"use client"

import { useRouter } from "next/navigation"
import { CreditCard } from "lucide-react"
import { MoneyDisplay, SectionHeader } from "@/components/shared"
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

export function BankCreditSection({ data, bankId }: Props) {
    const router = useRouter()
    const { company } = useBranding()
    const companyName = company?.trade_name || company?.name || ""
    const cards = data.accounts.filter(a => a.account_type === "CREDIT_CARD")

    if (cards.length === 0) return null

    return (
        <section>
            <SectionHeader
                icon={CreditCard}
                title="Tarjetas de Crédito"
                count={cards.length}
                href={`/treasury/bank-center/${bankId}/cards/unbilled`}
                variant="card"
            />

            <div className="space-y-3">
                {cards.map((card, idx) => {
                    const available = card.credit_limit != null
                        ? card.credit_limit - Math.abs(card.current_balance)
                        : 0
                    return (
                        <button
                            key={card.id}
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/cards/unbilled?card=${card.id}`)}
                            className={cn(
                                "relative w-full rounded-md bg-gradient-to-br px-4 pb-4 pt-3 text-white shadow-lg overflow-hidden text-left transition-all hover:brightness-110",
                                GRADIENTS[idx % GRADIENTS.length]
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-6 rounded bg-warning/30 flex items-center justify-center">
                                        <div className="w-6 h-4 rounded border border-warning/50" />
                                    </div>
                                    <span className="font-mono text-sm tracking-widest">
                                        {formatCardNumber(card.card_number || card.account_number || card.code)}
                                    </span>
                                </div>
                                <CreditCard className="h-4 w-4 opacity-60" />
                            </div>
                            <div className="text-[11px] font-mono text-white/70 mb-3">
                                {companyName}
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/20">
                                <div>
                                    <span className="text-[10px] text-white/70 block mb-0.5">Cupo</span>
                                    <MoneyDisplay amount={card.credit_limit || 0} showColor={false} className="text-white text-sm font-semibold" />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-white/70 block mb-0.5">Utilizado</span>
                                    <MoneyDisplay amount={Math.abs(card.current_balance)} showColor={false} className="text-white text-sm font-semibold" />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-white/70 block mb-0.5">Disponible</span>
                                    <MoneyDisplay amount={available} showColor={false} className="text-white text-sm font-semibold" />
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
