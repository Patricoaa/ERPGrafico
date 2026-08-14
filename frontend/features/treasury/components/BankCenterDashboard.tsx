"use client"

import { usePathname, useRouter } from "next/navigation"
import { EntityCard, PageSectionHeader, StaleDataBanner, TabBar } from "@/components/shared"
import { useBankOverview, type BankOverviewData } from "../hooks/useBankOverview"
import { getSubViewTabs } from "../constants"
import { BankUpcomingMaturitiesPanel } from "./BankUpcomingMaturities"
import { BankRecentActivity } from "./BankRecentActivity"
import { BankCheckingSection } from "./BankCheckingSection"
import { BankLoanSection } from "./BankLoanSection"

import { BankCreditSection } from "./BankCreditSection"
import { ChecksClientView } from "../checks/ChecksClientView"
import { LoansClientView } from "../loans/LoansClientView"
import { CardChargesView } from "../card-statements/CardChargesView"
import { BankMovementsClientView } from "./BankMovementsClientView"
import { StatementsClientView } from "@/features/finance"

const SUB_VIEW_LABELS: Record<string, string> = {
    overview: "Resumen",
    movements: "Movimientos",
    checks: "Cheques",
    loans: "Préstamos",
    cards: "Tarjeta",
    reconciliation: "Conciliación",
}

export function BankCenterDashboard({ bankId, subtab }: { bankId: number; subtab?: string }) {
    const pathname = usePathname()
    const router = useRouter()
    const segments = pathname.split("/").filter(Boolean)
    const activeTab = segments[3] || "overview"
    const queryResult = useBankOverview(bankId)
    const { data, isLoading, isError } = queryResult as { data: BankOverviewData | undefined; isLoading: boolean; isError: boolean }

    const overviewData = (data && !isError ? data : null) as BankOverviewData | null
    const bankName = overviewData?.bank?.name ?? "Cargando..."
    const checkingAccounts = overviewData
        ? overviewData.accounts.filter((a: { account_type: string }) => a.account_type === "CHECKING").map((a: { id: number; name: string }) => ({ id: a.id, name: a.name }))
        : []

    const subViewTabs = getSubViewTabs(bankId)

    const cardSubTabs = activeTab === "cards" ? [
        { value: "unbilled", label: "Cargos No Facturados", href: `/treasury/bank-center/${bankId}/cards/unbilled` },
        { value: "statements", label: "Cargos Facturados", href: `/treasury/bank-center/${bankId}/cards/statements` },
    ] : undefined
    const activeCardSubTab = activeTab === "cards" ? (segments[4] || "unbilled") : undefined

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar">
            <PageSectionHeader
                title={SUB_VIEW_LABELS[activeTab] || "Resumen"}
                description={bankName}
                subTabs={subViewTabs}
                subTabsBelow
            />
            {activeTab === "cards" && cardSubTabs && (
                <div className="flex justify-start pt-2">
                    <TabBar
                        items={cardSubTabs.map(t => ({ value: t.value, label: t.label }))}
                        value={activeCardSubTab ?? "unbilled"}
                        onValueChange={(value) => {
                            const tab = cardSubTabs.find(t => t.value === value)
                            if (tab) router.push(tab.href)
                        }}
                        variant="underline"
                        dense
                        className="w-full"
                        containerClassName="justify-start"
                    >
                        <div className="hidden" />
                    </TabBar>
                </div>
            )}
            {activeTab === "overview" && isLoading && <OverviewSkeleton />}
            {activeTab === "overview" && !isLoading && overviewData && (
                <div>
                    {isError && <StaleDataBanner className="mx-4 mt-2" />}
                    <section className="py-4">
                        <div className="flex flex-col lg:flex-row gap-5">
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <BankCheckingSection data={overviewData} bankId={bankId} />
                                <BankLoanSection data={overviewData} bankId={bankId} />
                            </div>
                            <div className="w-full lg:w-[380px] shrink-0">
                                <BankCreditSection data={overviewData} bankId={bankId} />
                            </div>
                        </div>
                    </section>
                    <section className="py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <BankUpcomingMaturitiesPanel data={overviewData} bankId={bankId} />
                            <BankRecentActivity data={overviewData} bankId={bankId} />
                        </div>
                    </section>
                </div>
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
                    <StatementsClientView
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
                        <div className="space-y-2">
                            <EntityCard.Skeleton variant="compact" showBody />
                            <EntityCard.Skeleton variant="compact" showBody />
                        </div>
                        <div className="space-y-2">
                            <EntityCard.Skeleton variant="compact" showBody />
                            <EntityCard.Skeleton variant="compact" showBody />
                        </div>
                    </div>
                    <div className="w-full lg:w-[380px] shrink-0">
                        <div className="space-y-3">
                            <EntityCard.Skeleton variant="compact" showBody />
                            <EntityCard.Skeleton variant="compact" showBody />
                        </div>
                    </div>
                </div>
            </div>
            <div className="py-4">
                <EntityCard.ListItemSkeleton count={5} />
            </div>
            <div className="py-4">
                <EntityCard.ListItemSkeleton count={4} />
            </div>
        </div>
    )
}
