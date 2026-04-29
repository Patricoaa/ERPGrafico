"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    getCreditPortfolio,
    getGlobalCreditHistory,
    CreditContact,
    CreditPortfolioResponse,
    CreditHistoryEntry
} from '@/features/credits/api/creditsApi'
import { toast } from "sonner"
import CreditAssignmentModal from "./CreditAssignmentModal"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/shared/EmptyState"
import { PortfolioKpiGrid } from "./PortfolioKpiGrid"
import { PortfolioTable } from "./PortfolioTable"
import { getPortfolioColumns, historyColumns } from "./PortfolioColumns"

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
    const [data, setData] = useState<CreditPortfolioResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [history, setHistory] = useState<CreditHistoryEntry[] | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(false)

    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<CreditContact | null>(null)

    const handleEditLimit = useCallback((contact: CreditContact) => {
        setEditingContact(contact)
        setAssignmentModalOpen(true)
    }, [])

    const portfolioCols = useMemo(() => getPortfolioColumns(handleEditLimit), [handleEditLimit])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await getCreditPortfolio()
            setData(result)
        } catch (error) {
            const e = error as { message?: string }
            setError(e.message || "Error cargando datos")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (activeTab === 'history' && !history) {
            setLoadingHistory(true)
            getGlobalCreditHistory()
                .then(setHistory)
                .catch(() => toast.error("Error cargando historial"))
                .finally(() => setLoadingHistory(false))
        }
    }, [activeTab, history])

    useEffect(() => {
        if (externalOpen) {
            setEditingContact(null)
            setAssignmentModalOpen(true)
        }
    }, [externalOpen])

    if (error) return (
        <EmptyState
            context="finance"
            title="Error al cargar datos"
            description={error}
            action={<Button onClick={load}>Reintentar</Button>}
        />
    )

    const contacts = data?.contacts || EMPTY_CONTACTS

    return (
        <div className="space-y-6">
            <CreditAssignmentModal
                open={assignmentModalOpen}
                onOpenChange={setAssignmentModalOpen}
                contact={editingContact}
                onSuccess={load}
            />

            {activeTab === 'portfolio' ? (
                <>
                    <PortfolioKpiGrid data={data} />

                    <div className="mt-6">
                        <PortfolioTable
                            columns={portfolioCols}
                            data={contacts}
                            isLoading={loading}
                            onRefresh={load}
                            createAction={createAction}
                        />
                    </div>
                </>
            ) : (
                <div className="mt-2">
                    <DataTable
                        columns={historyColumns}
                        data={history || EMPTY_HISTORY}
                        cardMode
                        isLoading={loadingHistory}
                        useAdvancedFilter
                        globalFilterFields={["customer_name", "number"]}
                        searchPlaceholder="Filtrar historial..."
                    />
                </div>
            )}
        </div>
    )
}
