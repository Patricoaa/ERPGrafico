"use client"

import { useCallback, useMemo, useState } from "react"

import { type CreditContact, type CreditHistoryEntry, writeOffDebt } from '@/features/credits/api/creditsApi'
import CreditAssignmentModal from "./CreditAssignmentModal"
import { DataTable, ActionConfirmModal, MoneyDisplay } from '@/components/shared'
import { PortfolioTable } from "./PortfolioTable"
import { creditContactFields } from "../creditContactFields"
import { creditHistoryEntryFields } from "../creditHistoryEntryFields"
import { portfolioActions, type PortfolioActionsCtx } from "../portfolioActions"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useCreditPortfolio, useCreditHistory } from "../hooks/useCredits"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { formatMoney } from "@/lib/money"
import { type ColumnDef } from "@tanstack/react-table"

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

    // ADR-0020: edit modal opens via ?selected={contactId}
    const { entity: selectedContact, isLoading: isLoadingSelected, clearSelection } =
        useSelectedEntity<CreditContact>({ endpoint: '/contacts' })
    const { openSelected } = useEntityRouteActions()

    const [writeOffContact, setWriteOffContact] = useState<CreditContact | null>(null)

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

    const portfolioCols = useMemo<ColumnDef<CreditContact>[]>(
        () => [
            ...creditContactFields.toColumns({ exclude: ['creditLastEvaluated'] }),
            portfolioActions.auto(portfolioCtx),
        ],
        [portfolioCtx],
    )

    const contactConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Cliente / RUT', serverParam: 'search', clientKey: ['name', 'tax_id'] },
        ],
        filters: [
            { key: 'risk_level', label: 'Riesgo', type: 'single', serverParam: 'risk_level', options: [
                { label: 'Bajo', value: 'LOW' },
                { label: 'Medio', value: 'MEDIUM' },
                { label: 'Alto', value: 'HIGH' },
                { label: 'Crítico', value: 'CRITICAL' },
            ]},
        ],
        groupBy: [
            { key: 'credit_risk_level', label: 'Riesgo', field: 'credit_risk_level' },
        ],
    }), [])
    const contactSearch = useUnifiedSearch(contactConfig)

    const historyConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Cliente / Folio', serverParam: 'search', clientKey: ['customer_name', 'number', 'display_id'] },
        ],
        filters: [
            { key: 'origin', label: 'Origen', type: 'single', serverParam: 'origin', options: [
                { label: 'Manual', value: 'MANUAL' },
                { label: 'Venta', value: 'SALE' },
                { label: 'Ajuste', value: 'ADJUSTMENT' },
                { label: 'Reversión', value: 'REVERSAL' },
            ]},
        ],
        groupBy: [
            { key: 'origin', label: 'Origen', field: 'origin' },
        ],
    }), [])
    const historySearch = useUnifiedSearch(historyConfig)

    const contacts = useMemo(
        () => {
            let result = rawContacts
            if (contactSearch.filters.risk_level) result = result.filter(c => c.credit_risk_level === contactSearch.filters.risk_level)
            return contactSearch.filterFn(result)
        },
        [rawContacts, contactSearch.filterFn, contactSearch.filters.risk_level],
    )
    const history = useMemo(
        () => {
            let result = rawHistory ?? EMPTY_HISTORY
            if (historySearch.filters.origin) result = result.filter(h => h.credit_assignment_origin === historySearch.filters.origin)
            return historySearch.filterFn(result)
        },
        [rawHistory, historySearch.filterFn, historySearch.filters.origin],
    )

    const handleModalSuccess = useCallback(async () => {
        await refetch()
        clearSelection()
    }, [refetch, clearSelection])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <CreditAssignmentModal
                open={!!selectedContact || isLoadingSelected || externalOpen}
                onOpenChange={(open) => { if (!open) clearSelection() }}
                contact={selectedContact}
                onSuccess={handleModalSuccess}
            />

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
                            <li>La clasificación de riesgo pasará a <span className="text-destructive font-bold uppercase tracking-wider text-[10px]">Crítico</span>.</li>
                            <li>Se realizarán ajustes técnicos en tesorería para saldar los documentos pendientes.</li>
                        </ul>
                    </div>
                }
                variant="destructive"
                icon={ShieldAlert}
                confirmText="Confirmar Castigo"
            />

            {activeTab === 'portfolio' ? (
                <div className="flex-1 min-h-0">
                    <PortfolioTable
                        columns={portfolioCols}
                        data={contacts}
                        isLoading={isLoading}
                        onRefresh={refetch}
                        createAction={createAction}
                        unifiedSearch={<UnifiedSearchBar
                            config={contactConfig}
                            chips={contactSearch.chips}
                            isFiltered={contactSearch.isFiltered}
                            inputValue={contactSearch.inputValue}
                            onInputChange={contactSearch.setInputValue}
                            onApply={contactSearch.applyFilter}
                            onRemove={contactSearch.removeFilter}
                            onClearAll={contactSearch.clearAll}
                            groupBy={contactSearch.groupBy}
                            onGroupBySelect={contactSearch.setGroupBy}
                            paramValues={contactSearch.paramValues}
                            placeholder="Cliente o RUT..."
                        />}
                    />
                </div>
            ) : (
                <div className="mt-2 flex-1 min-h-0">
                    <DataTable
                        columns={creditHistoryEntryFields.toColumns()}
                        data={history ?? EMPTY_HISTORY}
                        variant="embedded"
                        isLoading={loadingHistory}
                        unifiedSearch={<UnifiedSearchBar
                            config={historyConfig}
                            chips={historySearch.chips}
                            isFiltered={historySearch.isFiltered}
                            inputValue={historySearch.inputValue}
                            onInputChange={historySearch.setInputValue}
                            onApply={historySearch.applyFilter}
                            onRemove={historySearch.removeFilter}
                            onClearAll={historySearch.clearAll}
                            groupBy={historySearch.groupBy}
                            onGroupBySelect={historySearch.setGroupBy}
                            paramValues={historySearch.paramValues}
                            placeholder="Cliente o folio..."
                        />}
                    />
                </div>
            )}
        </div>
    )
}
