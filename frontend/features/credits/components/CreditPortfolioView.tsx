"use client"

import { useCallback, useMemo } from "react"
import { CreditContact, CreditHistoryEntry } from '@/features/credits/api/creditsApi'
import CreditAssignmentModal from "./CreditAssignmentModal"
import { DataTable } from '@/components/shared'
import { PortfolioKpiGrid } from "./PortfolioKpiGrid"
import { PortfolioTable } from "./PortfolioTable"
import { getPortfolioColumns, historyColumns } from "./PortfolioColumns"
import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { creditContactSearchDef, creditHistorySearchDef } from "../searchDef"
import { useCreditPortfolio, useCreditHistory } from "../hooks/useCredits"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

const EMPTY_CONTACTS: CreditContact[] = []
const EMPTY_HISTORY: CreditHistoryEntry[] = []

export function CreditPortfolioView({
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

    const contacts = useMemo(
        () => filterContacts(rawContacts),
        [rawContacts, filterContacts],
    )
    const history = useMemo(
        () => filterHistory(rawHistory ?? EMPTY_HISTORY),
        [rawHistory, filterHistory],
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
                    />
                </div>
            )}
        </div>
    )
}
