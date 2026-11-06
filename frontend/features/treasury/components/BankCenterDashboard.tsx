"use client"

import { usePathname, useRouter } from "next/navigation"
import { EntityCard, StaleDataBanner, TabBar } from "@/components/shared"
import { useBankOverview, type BankOverviewData } from "../hooks/useBankOverview"
import { BankUpcomingMaturitiesPanel } from "./BankUpcomingMaturities"
import { BankRecentActivity } from "./BankRecentActivity"
import { BankPositionSection } from "./BankPositionSection"
import { ChecksClientView } from "../checks/ChecksClientView"
import { LoansClientView } from "../loans/LoansClientView"
import { CardChargesView } from "../card-statements/CardChargesView"
import { BankMovementsClientView } from "./BankMovementsClientView"
import { StatementsClientView } from "@/features/finance"

export function BankCenterDashboard({ bankId, subtab }: { bankId: number; subtab?: string }) {
    const pathname = usePathname()
    const router = useRouter()
    const segments = pathname.split("/").filter(Boolean)
    const activeTab = segments[3] || "overview"
    const queryResult = useBankOverview(bankId)
    const { data, isLoading, isError } = queryResult as { data: BankOverviewData | undefined; isLoading: boolean; isError: boolean }

    const overviewData = (data && !isError ? data : null) as BankOverviewData | null

    const cardSubTabs = activeTab === "cards" ? [
        { value: "unbilled", label: "Cargos No Facturados", href: `/treasury/bank-center/${bankId}/cards/unbilled` },
        { value: "statements", label: "Cargos Facturados", href: `/treasury/bank-center/${bankId}/cards/statements` },
    ] : undefined
    const activeCardSubTab = activeTab === "cards" ? (segments[4] || "unbilled") : undefined

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar">
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
                <div className="p-4 space-y-5">
                    {isError && <StaleDataBanner />}
                    <BankPositionSection data={overviewData} bankId={bankId} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <BankRecentActivity movements={overviewData.recent_movements} bankId={bankId} />
                        <BankUpcomingMaturitiesPanel
                                maturities={overviewData.upcoming_maturities.map((m) => ({ ...m, bankId }))}
                                globalBankId={bankId}
                            />
                    </div>
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
                <div className="flex-1 min-h-0 flex flex-col">
                    <StatementsClientView bankId={bankId} />
                </div>
            )}
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <div className="p-4 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                    <EntityCard.Skeleton key={i} variant="compact" showBody />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <EntityCard.Skeleton variant="compact" showBody />
                <EntityCard.Skeleton variant="compact" showBody />
            </div>
        </div>
    )
}
