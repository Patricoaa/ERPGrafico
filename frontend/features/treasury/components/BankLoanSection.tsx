"use client"

import { useRouter } from "next/navigation"
import { HandCoins } from "lucide-react"
import { EntityCard, DataCell, SectionHeader } from "@/components/shared"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankLoanSection({ data, bankId }: Props) {
    const router = useRouter()
    const { active_loans } = data

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

            <div className="space-y-2">
                {active_loans.map(loan => (
                    <EntityCard
                        key={loan.id}
                        variant="compact"
                        onClick={() => router.push(`/treasury/bank-center/${bankId}/loans?selected=${loan.id}`)}
                    >
                        <EntityCard.Header
                            icon={HandCoins}
                            title={loan.display_id}
                            subtitle="Vigente"
                        />
                        <EntityCard.Metrics metrics={[
                            { label: "Capital", value: <DataCell.Currency value={loan.principal} showColor={false} /> },
                            { label: "Saldo Insoluto", value: <DataCell.Currency value={loan.outstanding_balance} /> },
                            { label: "Cuotas Rest.", value: `${loan.paid_installments_count}/${loan.installments_count}` },
                        ]} />
                    </EntityCard>
                ))}
            </div>
        </section>
    )
}
