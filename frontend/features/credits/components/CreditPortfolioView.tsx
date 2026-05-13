"use client"

import { useState, useCallback, useMemo } from "react"
import { CreditContact, CreditHistoryEntry } from '@/features/credits/api/creditsApi'

import CreditAssignmentModal from "./CreditAssignmentModal"
import { DataTable } from "@/components/ui/data-table"
import { PortfolioKpiGrid } from "./PortfolioKpiGrid"
import { PortfolioTable } from "./PortfolioTable"
import { getPortfolioColumns, historyColumns } from "./PortfolioColumns"
import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { creditContactSearchDef, creditHistorySearchDef } from "../searchDef"
import { useCreditPortfolio, useCreditHistory } from "../hooks/useCredits"

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

    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<CreditContact | null>(null)

    const handleEditLimit = useCallback((contact: CreditContact) => {
        setEditingContact(contact)
        setAssignmentModalOpen(true)
    }, [])

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
        setAssignmentModalOpen(false)
        setEditingContact(null)
    }, [refetch])

    return (
        <div className="space-y-6">
            <CreditAssignmentModal
                open={assignmentModalOpen || externalOpen}
                onOpenChange={(open) => {
                    setAssignmentModalOpen(open)
                    if (!open) setEditingContact(null)
                }}
                contact={editingContact}
                onSuccess={handleModalSuccess}
            />

            {activeTab === 'portfolio' ? (
                <>
                    <PortfolioKpiGrid data={data} />
                    <div className="mt-6">
                        <PortfolioTable
                            columns={portfolioCols}
                            data={contacts}
                            isLoading={isLoading}
                            onRefresh={refetch}
                            createAction={createAction}
                            leftAction={<SmartSearchBar searchDef={creditContactSearchDef} placeholder="Cliente o RUT..." />}
                        />
                    </div>
                </>
            ) : (
                <div className="mt-2">
                    <DataTable
                        columns={historyColumns}
                        data={history ?? EMPTY_HISTORY}
                        variant="embedded"
                        isLoading={loadingHistory}
                        leftAction={<SmartSearchBar searchDef={creditHistorySearchDef} placeholder="Cliente o folio..." />}
                    />
                </div>
            )}
        </div>
    )
}
