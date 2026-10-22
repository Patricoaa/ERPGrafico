"use client"

import { useRouter } from "next/navigation"
import { HandCoins } from "lucide-react"
import { SectionHeader } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { BankOverviewData } from "../hooks/useBankOverview"
import { bankLoanOverviewEntity, bankLoanOverviewViews } from "../entity-view/bankLoanOverview.entity"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankLoanSection({ data, bankId }: Props) {
    const router = useRouter()
    const { active_loans } = data
    const collection = useEntityCollection(bankLoanOverviewEntity, { rows: active_loans }, { pagination: { mode: "none" } })

    if (active_loans.length === 0) return null

    return (
        <section>
            <SectionHeader
                icon={HandCoins}
                title="Préstamos Bancarios"
                count={active_loans.length}
                href={`/treasury/bank-center/${bankId}/loans`}
                variant="list"
            />
            <Collection.Root
                collection={collection}
                defaultView="card"
                onOpen={(loan) => router.push(`/treasury/bank-center/${bankId}/loans?selected=${loan.id}`)}
            >
                <Collection.View card={bankLoanOverviewViews.card} />
            </Collection.Root>
        </section>
    )
}
