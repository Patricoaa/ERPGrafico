"use client"

import { useCallback, useMemo } from "react"
import { CreditCard, Target, ShieldAlert, Activity } from "lucide-react"
import { type CreditContact, type CreditHistoryEntry } from '@/features/credits/api/creditsApi'
import CreditAssignmentModal from "./CreditAssignmentModal"
import { DataTable } from '@/components/shared'
import { PortfolioTable } from "./PortfolioTable"
import { getPortfolioColumns, historyColumns } from "./PortfolioColumns"
import { UnifiedSearchBar, useUnifiedSearch, MoneyDisplay, type KpiCardDef } from "@/components/shared"
import type { UnifiedSearchConfig } from '@/types/unified-search'
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

    const kpiCards = useMemo<KpiCardDef[]>(() => {
        const s = data?.summary
        const totalDebt = Number(s?.total_debt || 0)
        const potentialLoss = Number(s?.potential_loss || 0)
        const totalOverdue = Number(s?.overdue_30 || 0) + Number(s?.overdue_60 || 0) + Number(s?.overdue_90 || 0) + Number(s?.overdue_90plus || 0)
        const contacts = data?.contacts || []
        const computedTotalLimit = contacts.reduce((acc, c) => {
            const limit = Number(c.credit_limit || 0)
            const balance = Number(c.credit_balance_used || 0)
            return acc + (limit > 0 ? limit : balance)
        }, 0)
        const computedUtilizationRate = computedTotalLimit > 0 ? (totalDebt / computedTotalLimit) * 100 : 0
        return [
            { label: "Deuda Total", value: <MoneyDisplay amount={totalDebt} />, subtext: `${s?.count_debtors || 0} clientes con deuda activa`, icon: CreditCard, accent: "primary" as const },
            { label: "Exposición Total", value: <MoneyDisplay amount={computedTotalLimit} />, subtext: `Uso: ${computedUtilizationRate.toFixed(1)}% del límite`, icon: Target, accent: "info" as const },
            { label: "Pérdida Potencial", value: <MoneyDisplay amount={potentialLoss} />, subtext: `${s?.risk_distribution?.CRITICAL || 0} riesgos críticos`, icon: ShieldAlert, accent: potentialLoss > 0 ? "destructive" as const : "muted" as const },
            { label: "Tasa de Mora", value: `${((totalOverdue / (totalDebt || 1)) * 100).toFixed(1)}%`, subtext: `${s?.count_overdue || 0} vencimientos`, icon: Activity, accent: totalOverdue > 0 ? "warning" as const : "success" as const },
        ]
    }, [data])

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
                        kpiCards={kpiCards}
                    />
                </div>
            ) : (
                <div className="mt-2 flex-1 min-h-0">
                    <DataTable
                        columns={historyColumns}
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
