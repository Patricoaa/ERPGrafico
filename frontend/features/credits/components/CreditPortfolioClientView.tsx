"use client"

import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { EntityPanelTab } from "@/components/providers"
import { useCallback, useMemo, useState } from "react"

import { type CreditContact, type CreditHistoryEntry, writeOffDebt } from '@/features/credits/api/creditsApi'
import CreditAssignmentModal from "./CreditAssignmentModal"
import { ActionConfirmModal, MoneyDisplay } from '@/components/shared'
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { portfolioActions, type PortfolioActionsCtx } from "../portfolioActions"
import { useCreditPortfolio, useCreditHistory } from "../hooks/useCredits"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { formatMoney } from "@/lib/money"
import {
    creditContactEntity,
    portfolioViews,
    creditHistoryEntryEntity,
    creditHistoryEntryViews,
} from "@/features/credits"
import { CreditContactLedgerDrawer } from "./CreditContactLedgerDrawer"

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
    const { contacts: rawContacts, isLoading, refetch } = useCreditPortfolio()
    const { data: rawHistory, isLoading: loadingHistory } = useCreditHistory()

    const assignmentPanel = useCreatePanelRoute<CreditContact>({ endpoint: '/contacts', external: { open: externalOpen } })
    const selectedContact = assignmentPanel.entity
    const clearSelection = assignmentPanel.close
    const { openSelected } = useEntityRouteActions()

    const [writeOffContact, setWriteOffContact] = useState<CreditContact | null>(null)
    const [ledgerContact, setLedgerContact] = useState<CreditContact | null>(null)

    const portfolioCtx = useMemo<PortfolioActionsCtx>(() => ({
        onEdit: (id) => openSelected(id),
        onWriteOff: (contact) => setWriteOffContact(contact),
        canWriteOff: (contact) => !contact.is_default_customer && Number(contact.credit_balance_used) > 0,
    }), [openSelected])

    const handleWriteOff = useCallback(async () => {
        if (!writeOffContact) return
        try {
            const res = await writeOffDebt(writeOffContact.id)
            toast.success(`Deuda castigada: ${res.journal_entry} por ${formatMoney(res.amount)}`)
            await refetch()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } }; message?: string }
            toast.error(e.response?.data?.error || e.message || "Error al castigar deuda")
        } finally {
            setWriteOffContact(null)
        }
    }, [writeOffContact, refetch])

    // Una barra por pestaña; solo una está montada, pero ambas leen la URL (como antes).
    const contactQuery = useCollectionQuery(creditContactEntity, { sorting: "client" })
    const historyQuery = useCollectionQuery(creditHistoryEntryEntity, { sorting: "client" })
    const filterContacts = contactQuery.search.filterFn
    const filterHistory = historyQuery.search.filterFn
    const contacts = useMemo(() => filterContacts(rawContacts), [filterContacts, rawContacts])
    const history = useMemo(() => filterHistory(rawHistory ?? EMPTY_HISTORY), [filterHistory, rawHistory])

    const portfolioCollection = useEntityCollection(
        creditContactEntity,
        { rows: isLoading ? [] : contacts, isFiltered: contactQuery.search.isFiltered },
        { pagination: { mode: "none" }, sorting: contactQuery.sorting, groupBy: contactQuery.groupBy },
    )

    const historyCollection = useEntityCollection(
        creditHistoryEntryEntity,
        { rows: loadingHistory ? [] : history, isFiltered: historyQuery.search.isFiltered },
        { pagination: { mode: "none" }, sorting: historyQuery.sorting, groupBy: historyQuery.groupBy },
    )

    const handleModalSuccess = useCallback(async () => {
        await refetch()
        clearSelection()
    }, [refetch, clearSelection])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <EntityPanelTab label="contacts.contact" variant="credit" display={selectedContact ? `Asignar crédito · ${selectedContact.name}` : "Asignar crédito"} {...assignmentPanel.tab}>
                {(open) => (
                    <CreditAssignmentModal
                        open={open}
                        onOpenChange={(open) => { if (!open) assignmentPanel.close() }}
                        contact={selectedContact}
                        onSuccess={handleModalSuccess}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={!!writeOffContact}
                onOpenChange={(o) => !o && setWriteOffContact(null)}
                onConfirm={handleWriteOff}
                title="¿Confirmar Castigo de Deuda?"
                description={
                    <div className="space-y-3 pt-1 text-sm leading-relaxed">
                        <p>Esta acción es <strong>irreversible</strong> y tiene las siguientes consecuencias:</p>
                        <ul className="list-disc list-inside space-y-1 font-medium text-muted-foreground">
                            <li>Se generará un asiento contable de pérdida por <span className="text-foreground"><MoneyDisplay amount={writeOffContact?.credit_balance_used} inline weight="bold" /></span>.</li>
                            <li>El cliente quedará bloqueado permanentemente.</li>
                            <li>La clasificación de riesgo pasará a <span className="text-destructive font-bold uppercase tracking-wider text-3xs">Crítico</span>.</li>
                            <li>Se realizarán ajustes técnicos en tesorería para saldar los documentos pendientes.</li>
                        </ul>
                    </div>
                }
                variant="destructive"
                icon={ShieldAlert}
                confirmText="Confirmar Castigo"
            />

            <EntityPanelTab label="contacts.contact" variant="ledger" id={ledgerContact?.id ?? null} open={!!ledgerContact} display={ledgerContact ? `Crédito · ${ledgerContact.name}` : undefined} onClose={() => setLedgerContact(null)}>
                {(open) => (
                    <CreditContactLedgerDrawer
                        contact={ledgerContact}
                        open={open}
                        onOpenChange={(open) => { if (!open) setLedgerContact(null) }}
                        mode="portfolio"
                        onRefresh={refetch}
                    />
                )}
            </EntityPanelTab>

            {activeTab === 'portfolio' ? (
                <div className="flex-1 flex flex-col min-h-0">
                    <Collection.Root
                        collection={portfolioCollection}
                        query={contactQuery}
                        actions={portfolioActions.forCollection(portfolioCtx)}
                        onOpen={(contact) => setLedgerContact(contact)}
                    >
                        <Collection.Toolbar action={createAction} />
                        <Collection.View
                            table={portfolioViews.table}
                            emptyTitle="Sin clientes con crédito"
                            emptyDescription="Habilite cupos de crédito para sus clientes para comenzar el seguimiento."
                            onResetFilters={contactQuery.search.clearAll}
                        />
                    </Collection.Root>
                </div>
            ) : (
                <div className="mt-2 flex-1 flex flex-col min-h-0">
                    <Collection.Root collection={historyCollection} query={historyQuery}>
                        <Collection.Toolbar />
                        <Collection.View
                            table={creditHistoryEntryViews.table}
                            emptyTitle="Sin historial"
                            emptyDescription="No hay asignaciones de crédito registradas."
                            onResetFilters={historyQuery.search.clearAll}
                        />
                    </Collection.Root>
                </div>
            )}
        </div>
    )
}
