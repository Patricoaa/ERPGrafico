"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Landmark } from "lucide-react"
import { SectionHeader } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { BankOverviewData } from "../hooks/useBankOverview"
import { bankCheckingAccountEntity, bankCheckingAccountViews } from "../entity-view/bankCheckingAccount.entity"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankCheckingSection({ data, bankId }: Props) {
    const router = useRouter()
    const checking = useMemo(() => data.accounts.filter(a => a.account_type === "CHECKING"), [data.accounts])
    const collection = useEntityCollection(bankCheckingAccountEntity, { rows: checking }, { pagination: { mode: "none" } })

    if (checking.length === 0) return null

    return (
        <section>
            <SectionHeader
                icon={Landmark}
                title="Cuentas Corrientes"
                count={checking.length}
                href={`/treasury/bank-center/${bankId}/movements`}
                variant="list"
            />
            <Collection.Root
                collection={collection}
                defaultView="card"
                onOpen={(acc) => router.push(`/treasury/bank-center/${bankId}/movements?account=${acc.id}`)}
            >
                <Collection.View card={bankCheckingAccountViews.card} />
            </Collection.Root>
        </section>
    )
}
