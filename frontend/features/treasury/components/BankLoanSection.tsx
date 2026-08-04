"use client"

import { useRouter } from "next/navigation"
import { HandCoins } from "lucide-react"
import { AutoEntityCard, DataCell, SectionHeader, createEntityFields } from "@/components/shared"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

const loanFields = createEntityFields<BankOverviewData["active_loans"][number]>()({})

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
                    <AutoEntityCard
                        key={loan.id}
                        data={loan}
                        fields={loanFields}
                        variant="overview"
                        icon={HandCoins}
                        title={loan.display_id}
                        subtitle="Vigente"
                        overviewMetrics={[
                            { label: "Capital", value: <DataCell.Currency value={loan.principal} showColor={false} /> },
                            { label: "Saldo Insoluto", value: <DataCell.Currency value={loan.outstanding_balance} /> },
                            { label: "Cuotas Rest.", value: `${loan.paid_installments_count}/${loan.installments_count}` },
                        ]}
                        onClick={() => router.push(`/treasury/bank-center/${bankId}/loans?selected=${loan.id}`)}
                    />
                ))}
            </div>
        </section>
    )
}
