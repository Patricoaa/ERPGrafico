"use client"

import { useRouter } from "next/navigation"
import { CreditCard } from "lucide-react"
import { EntityCard, MoneyDisplay, SectionHeader } from "@/components/shared"
import { useBranding } from "@/contexts/BrandingProvider"
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
                variant="list"
            />

            <div className="space-y-3">
                {cards.map(card => {
                    const available = card.credit_limit != null
                        ? card.credit_limit - Math.abs(card.current_balance)
                        : 0
                    return (
                        <EntityCard
                            key={card.id}
                            variant="compact"
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/cards/unbilled?card=${card.id}`)}
                        >
                            <EntityCard.Header
                                icon={CreditCard}
                                title={formatCardNumber(card.card_number || card.account_number || card.code)}
                                subtitle={companyName || undefined}
                            />
                            <EntityCard.Body className="flex flex-row items-stretch gap-3">
                                <EntityCard.Field label="Cupo" value={<MoneyDisplay amount={card.credit_limit || 0} showColor={false} />} className="flex-1" />
                                <EntityCard.Field label="Utilizado" value={<MoneyDisplay amount={Math.abs(card.current_balance)} showColor={false} />} className="flex-1" />
                                <EntityCard.Field label="Disponible" value={<MoneyDisplay amount={available} showColor={false} />} className="flex-1" />
                            </EntityCard.Body>
                        </EntityCard>
                    )
                })}
            </div>
        </section>
    )
}
