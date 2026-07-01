"use client"

import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Skeleton, EmptyState, PageSectionHeader } from "@/components/shared"
import { useMemo } from "react"
import { useBankOverview, type BankOverviewData } from "../hooks/useBankOverview"
import { getSubViewTabs } from "../constants"
import { BankUpcomingMaturities } from "./BankUpcomingMaturities"
import { BankRecentActivity } from "./BankRecentActivity"
import { BankOverviewCheckingCards } from "./BankOverviewCheckingCards"
import { BankOverviewLoanCards } from "./BankOverviewLoanCards"

import { BankOverviewCreditCards } from "./BankOverviewCreditCards"
import { ChecksClientView } from "../checks/ChecksClientView"
import { LoansClientView } from "../loans/LoansClientView"
import { CardChargesView } from "../card-statements/CardChargesView"
import { BankMovementsClientView } from "./BankMovementsClientView"
import { StatementsList } from "@/features/finance"

export function BankCenterDashboard({ bankId, subtab }: { bankId: number; subtab?: string }) {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)
    const activeTab = segments[3] || "overview"
    const queryResult = useBankOverview(bankId)
    const { data, isLoading, isError } = queryResult as { data: BankOverviewData | undefined; isLoading: boolean; isError: boolean }

    const overviewData = (data && !isError ? data : null) as BankOverviewData | null
    const bankName = overviewData?.bank?.name ?? "Cargando..."
    const checkingAccounts = overviewData
        ? overviewData.accounts.filter((a: { account_type: string }) => a.account_type === "CHECKING").map((a: { id: number; name: string }) => ({ id: a.id, name: a.name }))
        : []

    const cardSubTabs = useMemo(() => {
        if (activeTab !== "cards") return undefined
        return [
            { value: "unbilled", label: "Cargos No Facturados", href: `/treasury/bank-center/${bankId}/cards/unbilled` },
            { value: "statements", label: "Cargos Facturados", href: `/treasury/bank-center/${bankId}/cards/statements` },
        ]
    }, [activeTab, bankId])

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar">
            <PageSectionHeader title={bankName} tabs={getSubViewTabs(bankId)} subTabs={cardSubTabs} />
            {activeTab === "overview" && isLoading && <OverviewSkeleton />}
            {activeTab === "overview" && !isLoading && (
                isError ? (
                    <div className="flex-1 flex items-center justify-center">
                        <EmptyState
                            title="Error al cargar datos del banco"
                            description="Intente nuevamente más tarde."
                            icon={AlertTriangle}
                        />
                    </div>
                ) : overviewData ? (
                    <div>
                        <section className="py-4">
                            <div className="flex flex-col lg:flex-row gap-5">
                                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    <BankOverviewCheckingCards data={overviewData} bankId={bankId} />
                                    <BankOverviewLoanCards data={overviewData} bankId={bankId} />
                                </div>
                                <div className="w-full lg:w-[380px] shrink-0">
                                    <BankOverviewCreditCards data={overviewData} bankId={bankId} />
                                </div>
                            </div>
                        </section>
                        <div className="border-b border-border/40" />
                        <section className="py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <BankUpcomingMaturities data={overviewData} bankId={bankId} />
                                <BankRecentActivity data={overviewData} bankId={bankId} />
                            </div>
                        </section>
                    </div>
                ) : null
            )}

            {activeTab === "movements" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <BankMovementsClientView bankId={bankId} />
                </div>
            )}
            {activeTab === "checks" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <ChecksClientView bankId={bankId} direction="ISSUED" />
                </div>
            )}
            {activeTab === "loans" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <LoansClientView bankId={bankId} />
                </div>
            )}
            {activeTab === "cards" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <CardChargesView bankId={bankId} subtab={subtab} />
                </div>
            )}
            {activeTab === "reconciliation" && (
                <div className="flex-1 min-h-0">
                    <StatementsList
                        bankId={bankId}
                        detailBasePath={`/treasury/bank-center/${bankId}/reconciliation`}
                        accounts={checkingAccounts}
                    />
                </div>
            )}
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <div className="space-y-0">
            <div className="py-4">
                <div className="flex flex-col lg:flex-row gap-5">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Skeleton className="h-28" />
                        <Skeleton className="h-28" />
                    </div>
                    <div className="w-full lg:w-[380px] shrink-0">
                        <Skeleton className="h-48" />
                    </div>
                </div>
            </div>
            <div className="border-b border-border/40" />
            <div className="py-4">
                <Skeleton className="h-4 w-64 mb-3" />
                <Skeleton className="h-5 w-full mb-1" />
                <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="border-b border-border/40" />
            <div className="py-4">
                <Skeleton className="h-4 w-48 mb-3" />
                <Skeleton className="h-6 w-full mb-1" />
                <Skeleton className="h-6 w-full mb-1" />
                <Skeleton className="h-6 w-3/4" />
            </div>
        </div>
    )
}
