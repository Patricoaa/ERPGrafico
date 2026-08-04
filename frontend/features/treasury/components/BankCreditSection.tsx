"use client"

import { useRouter } from "next/navigation"
import { CreditCard } from "lucide-react"
import { AutoEntityCard, DataCell, SectionHeader, createEntityFields } from "@/components/shared"
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

const creditFields = createEntityFields<BankOverviewData["accounts"][number]>()({})

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
                        <AutoEntityCard
                            key={card.id}
                            data={card}
                            fields={creditFields}
                            variant="overview"
                            icon={CreditCard}
                            title={formatCardNumber(card.card_number || card.account_number || card.code)}
                            subtitle={companyName || undefined}
                            overviewMetrics={[
                                { label: "Cupo", value: <DataCell.Currency value={card.credit_limit || 0} showColor={false} /> },
                                { label: "Utilizado", value: <DataCell.Currency value={Math.abs(card.current_balance)} showColor={false} /> },
                                { label: "Disponible", value: <DataCell.Currency value={available} showColor={false} /> },
                            ]}
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/cards/unbilled?card=${card.id}`)}
                        />
                    )
                })}
            </div>
        </section>
    )
}
