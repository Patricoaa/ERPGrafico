"use client"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"

import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"

import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { posSessionEntity, posSessionViews } from "../entity-view/posSession.entity"
import { posSessionActions, type POSSessionActionsCtx } from "@/features/sales/posSessionActions"
import { GatedSessionCloseModal } from "@/features/pos"
import type { POSSession as POSSessionModal } from "@/features/pos"

export interface POSSession {
    id: number
    /** Modo de caja de este dispositivo en la sesión (SINGLE | MULTI). */
    my_mode: 'SINGLE' | 'MULTI'
    /** Id del usuario que abrió la sesión de POS. */
    user: number
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

import { usePOSSessions, useDownloadPOSReportPDF, POS_SESSIONS_QUERY_KEY } from "@/features/pos"
import { posSessionUnifiedSearchDef } from "@/features/pos/unifiedSearchDef"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const SESSION_GROUPS: Record<string, FieldId<typeof posSessionEntity.fields>> = { status: "status" }

export const POSSessionsClientView = ({}: POSSessionsClientViewProps) => {
    const search = useUnifiedSearch(posSessionUnifiedSearchDef)
    const { sessions, isLoading, isError, refetch } = usePOSSessions(search.filters)
    const groupBy = search.groupBy ? SESSION_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("pos.session")
    const collection = useEntityCollection(
        posSessionEntity,
        { rows: sessions, isLoading, error: isError, refetch, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 10 }, groupBy, defaultSort: posSessionViews.table.defaultSort },
    )

    // La ficha de la sesión (resumen + informe X/Z + relaciones) es la única superficie de la sesión.
    const sheet = useDocumentSheetRoute("treasury.possession")

    const [selectedSession, setSelectedSession] = useState<POSSession | null>(null)
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const queryClient = useQueryClient()

    const handleCloseSuccess = () => {
        void queryClient.invalidateQueries({ queryKey: POS_SESSIONS_QUERY_KEY })
        void queryClient.invalidateQueries({ queryKey: ['pos-session', selectedSession?.id] })
        // Al cerrar se muestra su informe Z en la ficha.
        if (selectedSession && !(sheet.selectedId === selectedSession.id && sheet.isOpen)) sheet.toggle(selectedSession.id)
        refetch()
    }

    const { user: authUser } = useAuth()

    const { downloadPdf } = useDownloadPOSReportPDF()

    const actionsCtx: POSSessionActionsCtx = {
        // #233: solo quien abrió la sesión de POS o un superusuario puede cerrarla.
        canClose: (session) => !!authUser && (authUser.is_superuser || authUser.id === Number(session.user)),
        onOpen: (session) => sheet.toggle(session.id),
        onDownloadReport: async (session, type) => {
            try {
                await downloadPdf(session.id, type)
            } catch {
                // toast handled inside downloadPdf
            }
        },
        onCloseRegister: (session) => {
            setSelectedSession(session)
            setCloseDialogOpen(true)
        },
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(session) => sheet.toggle(session.id)}
                actions={posSessionActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar config={posSessionUnifiedSearchDef} {...bindUnifiedSearch(search)} />
                </Collection.Toolbar>
                <Collection.View
                    table={posSessionViews.table}
                    card={posSessionViews.card}
                    emptyTitle="Aún no hay sesiones POS"
                    emptyDescription="Las sesiones del punto de venta aparecerán aquí al iniciar sesión."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            {selectedSession && <GatedSessionCloseModal open={closeDialogOpen} onOpenChange={setCloseDialogOpen} session={selectedSession as unknown as POSSessionModal} onSuccess={handleCloseSuccess} />}
        </div>
    )
}
