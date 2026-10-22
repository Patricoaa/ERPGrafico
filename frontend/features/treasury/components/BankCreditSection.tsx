"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { CreditCard } from "lucide-react"
import { SectionHeader } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { BankOverviewData } from "../hooks/useBankOverview"
import { bankCreditCardEntity, bankCreditCardViews } from "../entity-view/bankCreditCard.entity"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankCreditSection({ data, bankId }: Props) {
    const router = useRouter()
    const cards = useMemo(() => data.accounts.filter(a => a.account_type === "CREDIT_CARD"), [data.accounts])
    const collection = useEntityCollection(bankCreditCardEntity, { rows: cards }, { pagination: { mode: "none" } })

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
            <Collection.Root
                collection={collection}
                defaultView="card"
                onOpen={(card) => router.push(`/treasury/bank-center/${bankId}/cards/unbilled?card=${card.id}`)}
            >
                <Collection.View card={bankCreditCardViews.card} />
            </Collection.Root>
        </section>
    )
}
