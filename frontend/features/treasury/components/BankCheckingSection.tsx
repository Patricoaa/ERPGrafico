"use client"

import { useRouter } from "next/navigation"
import { Landmark } from "lucide-react"
import { EntityCard, DataCell, SectionHeader } from "@/components/shared"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankCheckingSection({ data, bankId }: Props) {
    const router = useRouter()
    const checking = data.accounts.filter(a => a.account_type === "CHECKING")

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

            <div className="space-y-2">
                {checking.map(acc => {
                    const creditLine = acc.credit_line_credit_limit ?? 0
                    const available = creditLine > 0
                        ? Math.max(0, acc.current_balance + creditLine)
                        : acc.current_balance

                    return (
                        <EntityCard
                            key={acc.id}
                            variant="compact"
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/movements?account=${acc.id}`)}
                        >
                            <EntityCard.Header
                                icon={Landmark}
                                title={acc.name}
                                subtitle={acc.account_number ?? acc.code ?? "—"}
                            />
                            <EntityCard.Metrics metrics={[
                                { label: "Saldo", value: <DataCell.Currency value={acc.current_balance} /> },
                                { label: "Línea", value: <DataCell.Currency value={creditLine} showColor={false} /> },
                                { label: "Disponible", value: <DataCell.Currency value={available} showColor={available >= 0} /> },
                            ]} />
                        </EntityCard>
                    )
                })}
            </div>
        </section>
    )
}
