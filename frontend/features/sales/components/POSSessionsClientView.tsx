"use client"
import { useState } from "react"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

import {DataTableView, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch} from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { posSessionFields } from "../posSessionFields"
import { posSessionActions, type POSSessionActionsCtx } from "@/features/sales/posSessionActions"
import { POSReport, type POSReportData } from "@/features/pos"
import { SessionCloseModal } from "@/features/pos"
import type { POSSession as POSSessionModal } from "@/features/pos"
import { fetchPOSSessionSummary } from "@/features/pos"

export interface POSSession {
    id: number
    id_display: string
    user_name: string
    treasury_account: number | null
    treasury_account_name: string | null
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    current_cash?: number
    expected_cash: number
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_check_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

interface POSSessionsClientViewProps {
    hideHeader?: boolean
}

import { usePOSSessions, usePOSSessionSummary } from "@/features/pos"
import { posSessionUnifiedSearchDef } from "@/features/pos/unifiedSearchDef"

export const POSSessionsClientView = ({}: POSSessionsClientViewProps) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(posSessionUnifiedSearchDef)
    const { sessions, isLoading, refetch } = usePOSSessions(search.filters)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<POSSession>({
        endpoint: '/treasury/pos-sessions'
    })

    const [selectedSession, setSelectedSession] = useState<POSSession | null>(null)
    const [manualReportData, setManualReportData] = useState<Record<string, unknown> | null>(null)
    const [manualReportType, setManualReportType] = useState<"X" | "Z">("X")
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)

    const reportSessionId = selectedFromUrl ? selectedFromUrl.id : null
    const { data: queryReportData } = usePOSSessionSummary<Record<string, unknown>>(reportSessionId)

    const isReportDialogOpen = !!selectedFromUrl || manualReportData !== null
    const finalReportData = selectedFromUrl ? queryReportData : manualReportData
    const finalReportType = selectedFromUrl ? (selectedFromUrl.status === 'CLOSED' ? 'Z' : 'X') : manualReportType

    const handleCloseSuccess = async () => {
        if (!selectedSession) return
        try {
            const data = await fetchPOSSessionSummary<Record<string, unknown>>(selectedSession.id)
            setManualReportData(data)
            setManualReportType("Z")
            refetch()
        } catch (error) {
            console.error("Error fetching Z report:", error)
        }
    }

    const actionsCtx: POSSessionActionsCtx = {
        onReport: (session) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(session.id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
        onCloseRegister: (session) => {
            setSelectedSession(session)
            setCloseDialogOpen(true)
        },
    }

    const columns: ColumnDef<POSSession>[] = [
        ...posSessionFields.toColumns(),
        posSessionActions.auto(actionsCtx),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={sessions}
                    variant="embedded"
                    isLoading={isLoading}
                    entityLabel="pos.session"
                    unifiedSearch={<UnifiedSearchBar
                        config={posSessionUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                    />}
                    unifiedSearchConfig={posSessionUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={10}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "pos",
                        title: "Aún no hay sesiones POS",
                        description: "Las sesiones del punto de venta aparecerán aquí al iniciar sesión.",
                    }}
                    renderCard={(session: POSSession) => (
                        <AutoEntityCard
                            data={session}
                            fields={posSessionFields}

                            entityLabel="pos.session"
                            title={session.user_name}

                            actions={posSessionActions.render(session, actionsCtx)}
                            defaultAction={posSessionActions.defaultAction(actionsCtx)?.(session) ?? null} 
                            onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set('selected', String(session.id))
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            }}
                        />
                    )}
                />
            </div>

            {/* Custom Overlay for POS Reports (X and Z) - Consistency with POS */}
            {isReportDialogOpen && (
                <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden text-foreground">
                    <div className="w-full max-w-sm animate-in zoom-in-95 duration-200">
                        {finalReportData && (
                            <POSReport
                                data={finalReportData as unknown as POSReportData}
                                type={finalReportType}
                                title={finalReportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                                onClose={() => {
                                    if (selectedFromUrl) {
                                        clearSelection()
                                    } else {
                                        setManualReportData(null)
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {selectedSession && <SessionCloseModal open={closeDialogOpen} onOpenChange={setCloseDialogOpen} session={selectedSession as unknown as POSSessionModal} onSuccess={handleCloseSuccess} />}
        </div>
    )
}
