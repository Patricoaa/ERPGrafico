"use client"

import { useCallback, useMemo } from "react"
import { CreditContact, CreditHistoryEntry } from '@/features/credits/api/creditsApi'
import CreditAssignmentModal from "./CreditAssignmentModal"
import { DataTable } from '@/components/shared'
import { PortfolioKpiGrid } from "./PortfolioKpiGrid"
import { PortfolioTable } from "./PortfolioTable"
import { getPortfolioColumns, historyColumns } from "./PortfolioColumns"
import { SmartSearchBar, useClientSearch, useSegmentation, SegmentationBar } from "@/components/shared"
import { creditContactSearchDef, creditHistorySearchDef } from "../searchDef"
import { creditContactSegDef, creditHistorySegDef } from "../segmentationDef"
import { useCreditPortfolio, useCreditHistory } from "../hooks/useCredits"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

const EMPTY_CONTACTS: CreditContact[] = []
const EMPTY_HISTORY: CreditHistoryEntry[] = []

export function CreditPortfolioClientView({
    activeTab = 'portfolio',
    externalOpen = false,
    createAction
}: {
    activeTab?: 'portfolio' | 'history',
    externalOpen?: boolean,
    createAction?: React.ReactNode
}) {
    const { data, contacts: rawContacts, isLoading, refetch } = useCreditPortfolio()
    const { data: rawHistory, isLoading: loadingHistory } = useCreditHistory()

    // ADR-0020: edit modal opens via ?selected={contactId}
    const { entity: selectedContact, isLoading: isLoadingSelected, clearSelection } =
        useSelectedEntity<CreditContact>({ endpoint: '/contacts' })
    const { openSelected } = useEntityRouteActions()

    const handleEditLimit = useCallback((contact: CreditContact) => {
        openSelected(contact.id)
    }, [openSelected])

    const portfolioCols = useMemo(() => getPortfolioColumns(handleEditLimit), [handleEditLimit])

    const { filterFn: filterContacts } = useClientSearch<CreditContact>(creditContactSearchDef)
    const { filterFn: filterHistory } = useClientSearch<CreditHistoryEntry>(creditHistorySearchDef)
    const { filters: segContactFilters } = useSegmentation(creditContactSegDef)
    const { filters: segHistoryFilters } = useSegmentation(creditHistorySegDef)

    const contacts = useMemo(
        () => {
            let result = rawContacts
            if (segContactFilters.risk_level) result = result.filter(c => c.credit_risk_level === segContactFilters.risk_level)
            return filterContacts(result)
        },
        [rawContacts, filterContacts, segContactFilters.risk_level],
    )
    const history = useMemo(
        () => {
            let result = rawHistory ?? EMPTY_HISTORY
            if (segHistoryFilters.origin) result = result.filter(h => h.credit_assignment_origin === segHistoryFilters.origin)
            return filterHistory(result)
        },
        [rawHistory, filterHistory, segHistoryFilters.origin],
    )

    const handleModalSuccess = useCallback(async () => {
        await refetch()
        clearSelection()
    }, [refetch, clearSelection])

    return (
        <div className="h-full flex flex-col">
            <CreditAssignmentModal
                open={!!selectedContact || isLoadingSelected || externalOpen}
                onOpenChange={(open) => { if (!open) clearSelection() }}
                contact={selectedContact}
                onSuccess={handleModalSuccess}
            />

            {activeTab === 'portfolio' ? (
                <div className="flex-1 min-h-0 flex flex-col">
                    <PortfolioKpiGrid data={data} />
                    <div className="mt-6 flex-1 min-h-0">
                        <PortfolioTable
                            columns={portfolioCols}
                            data={contacts}
                            isLoading={isLoading}
                            onRefresh={refetch}
                            createAction={createAction}
                            smartSearch={<SmartSearchBar searchDef={creditContactSearchDef} placeholder="Cliente o RUT..." className="w-full" />}
                            segmentation={<SegmentationBar def={creditContactSegDef} />}
                        />
                    </div>
                </div>
            ) : (
                <div className="mt-2 flex-1 min-h-0">
                    <DataTable
                        columns={historyColumns}
                        data={history ?? EMPTY_HISTORY}
                        variant="embedded"
                        isLoading={loadingHistory}
                        smartSearch={<SmartSearchBar searchDef={creditHistorySearchDef} placeholder="Cliente o folio..." className="w-full" />}
                        segmentation={<SegmentationBar def={creditHistorySegDef} />}
                    />
                </div>
            )}
        </div>
    )
}
