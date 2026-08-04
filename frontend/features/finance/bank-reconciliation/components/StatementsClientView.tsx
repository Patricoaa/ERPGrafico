"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Upload, Activity, ChevronDown, CheckCircle2 } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import { useStatementQuery } from "../hooks/useReconciliationQueries"
import type { BankStatement } from "../types"
import { StatementImportModal, StatementDetailPanel, ReconciliationPanel } from "@/features/finance"
import { useConfirmStatement } from "@/features/treasury"
import {DataTableView, UnifiedSearchBar, useUnifiedSearch, AutoEntityCard, EntityCard, ToolbarCreateButton, Drawer, EmptyState, ActionConfirmModal, ActionSlideButton} from '@/components/shared'
import type { ColumnDef } from "@tanstack/react-table"
import { statementFields } from "../statementFields"
import { statementActions, type StatementActionsCtx } from './statementActions'
import type { UnifiedSearchConfig, MultiSelectOption } from '@/types/unified-search'
import { cn } from "@/lib/utils"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface StatementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
    bankId?: number
    accounts?: Array<{ id: number; name: string }>
    detailBasePath?: string
}

export function StatementsClientView({ externalOpen = false, createAction, bankId, accounts, detailBasePath }: StatementsClientViewProps) {
    const statementDetailUrl = (id: number) => detailBasePath ? `${detailBasePath}/${id}` : `/treasury/reconciliation/${id}`
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const [importModalOpen, setImportModalOpen] = useState(false)
    const [modalKey, setModalKey] = useState(0)
    const [expandedStmtId, setExpandedStmtId] = useState<number | null>(null)
    const [workbenchStatementId, setWorkbenchStatementId] = useState<number | null>(null)

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        bank_account: (accounts ?? []).map((a) => ({ label: a.name, value: String(a.id) })),
    }), [accounts])

    const statementsUnifiedConfig = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [
            {
                key: 'display_id',
                label: 'Cartola',
                serverParam: 'search',
                clientKey: ['display_id', 'treasury_account_name'],
            },
        ],
        filters: [
            {
                type: 'single',
                key: 'bank_account',
                label: 'Cuenta Bancaria',
                serverParam: 'bank_account_id',
                dynamic: true,
            },
            {
                type: 'single',
                key: 'state',
                label: 'Estado',
                serverParam: 'state',
                options: [
                    { label: 'Borrador', value: 'DRAFT' },
                    { label: 'Confirmado', value: 'CONFIRMED' },
                    { label: 'Anulado', value: 'CANCELLED' },
                ],
            },
        ],
    }), [])

    const search = useUnifiedSearch(statementsUnifiedConfig, filterOptions)

    const isFiltered = search.isFiltered
    const handleReset = useCallback(() => {
        search.clearAll()
    }, [search])

    const { data: statements = [], isLoading, refetch } = useStatementsQuery(
        search.filters.bank_account_id && search.filters.bank_account_id !== 'all'
            ? { treasury_account: search.filters.bank_account_id }
            : bankId
            ? { bank: String(bankId) }
            : undefined,
    )

    const filteredStatements = useMemo(() => {
        let result = search.filterFn(statements)
        if (search.filters.state) {
            result = result.filter((s) => s.state === search.filters.state)
        }
        return result
    }, [statements, search.filterFn, search.filters])

    // Open import dialog when triggered via URL (?modal=import)
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setImportModalOpen(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    // Auto-expand ?selected= deep-link (Phase 4)
    useEffect(() => {
        const selectedId = searchParams.get('selected')
        if (selectedId) {
            const numId = Number(selectedId)
            if (!isNaN(numId)) {
                const handle = requestAnimationFrame(() => setExpandedStmtId(numId))
                return () => cancelAnimationFrame(handle)
            }
        }
    }, [searchParams])

    // Auto-open ?workbench= deep-link (Phase 4)
    useEffect(() => {
        const wbId = searchParams.get('workbench')
        if (wbId) {
            const numId = Number(wbId)
            if (!isNaN(numId)) {
                const handle = requestAnimationFrame(() => setWorkbenchStatementId(numId))
                return () => cancelAnimationFrame(handle)
            }
        }
    }, [searchParams])

    const handleImportSuccess = () => {
        refetch()
        setImportModalOpen(false)
        setModalKey(k => k + 1)
        if (accounts) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('modal')
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        } else {
            router.replace('/treasury/reconciliation')
        }
    }

    const handleModalChange = (open: boolean) => {
        setImportModalOpen(open)
        if (!open) {
            setModalKey(k => k + 1)
            const params = new URLSearchParams(searchParams.toString())
            params.delete('modal')
            const query = params.toString()
            if (accounts) {
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
            } else {
                router.replace('/treasury/reconciliation')
            }
        }
    }

    const openWorkbench = (stmtId: number) => {
        setWorkbenchStatementId(stmtId)
        const params = new URLSearchParams(searchParams.toString())
        params.set('workbench', String(stmtId))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeWorkbench = () => {
        setWorkbenchStatementId(null)
        const params = new URLSearchParams(searchParams.toString())
        params.delete('workbench')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const actionsCtx: StatementActionsCtx = {
        onView: (id) => router.push(statementDetailUrl(id)),
    }

    const columns = useMemo<ColumnDef<BankStatement>[]>(() => {
        return [
            ...statementFields.toColumns(),
            statementActions.auto(actionsCtx)
        ]
    }, [])

    const internalImportButton = accounts !== undefined ? (
        <ToolbarCreateButton
            label="Importar Cartola"
            icon={Upload}
            onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('modal', 'import')
                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                setImportModalOpen(true)
            }}
        />
    ) : undefined

    const renderLoadingView = () => (
        <div className="space-y-4 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <EntityCard.Skeleton key={i} variant="full" showFooter />
            ))}
        </div>
    )

    const renderCustomView = (table: { getRowModel: () => { rows: Array<{ original: BankStatement }> } }) => {
        const rows = table.getRowModel().rows
        if (rows.length === 0) {
            return (
                <div className="pt-4">
                    <EmptyState
                        context="finance"
                        title="No hay cartolas importadas"
                        description="Importa una cartola bancaria para comenzar la conciliación."
                    />
                </div>
            )
        }
        return (
            <div className="space-y-3 pt-2">
                {rows.map((row) => {
                    const stmt = row.original
                    const isExpanded = expandedStmtId === stmt.id
                    return (
                        <AutoEntityCard 
                            key={stmt.id} 
                            data={stmt} 
                            fields={statementFields}

                            className="overflow-hidden"
                            entityLabel="treasury.bankstatement"
                        >
                            {/* Escape hatch: action buttons (Reconciliar, Ver Detalle) — not expressible as fields */}
                            <EntityCard.Footer>
                                <div className="flex items-center gap-2">
                                    {stmt.state !== 'CONFIRMED' && stmt.reconciliation_progress < 100 && (
                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); openWorkbench(stmt.id) }}>
                                            <Activity className="h-3.5 w-3.5 mr-1" />
                                            Reconciliar
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); setExpandedStmtId(isExpanded ? null : stmt.id) }}
                                    >
                                        <ChevronDown className={cn("h-3 w-3 mr-1 transition-transform duration-200", isExpanded && "rotate-180")} />
                                        {isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}
                                    </Button>
                                </div>
                            </EntityCard.Footer>
                            {isExpanded && (
                                <div className="border-t border-border mt-2 pt-4">
                                    <StatementDetailPanel
                                        statementId={stmt.id}
                                        bankId={bankId}
                                        hideCreateAction
                                        detailOnly
                                    />
                                </div>
                            )}
                        </AutoEntityCard>
                    )
                })}
            </div>
        )
    }

    // Workbench drawer state: fetch statement for confirm button
    const { data: workbenchStatement } = useStatementQuery(workbenchStatementId ?? 0, !!workbenchStatementId)
    const confirmMutation = useConfirmStatement()
    const confirmAction = useConfirmAction(async () => {
        if (!workbenchStatementId) return
        try {
            await confirmMutation.mutateAsync(workbenchStatementId)
            toast.success('Cartola confirmada exitosamente')
            closeWorkbench()
            refetch()
        } catch (error: unknown) {
            showApiError(error, 'Error al confirmar cartola')
        }
    })

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.bankstatement"
                    columns={columns}
                    data={filteredStatements}
                    variant="embedded"
                    isLoading={isLoading}
                    isFiltered={isFiltered}
                    showReset={isFiltered}
                    emptyState={{
                        context: 'finance',
                        title: 'No hay cartolas importadas',
                        description: 'Importa una cartola bancaria para comenzar la conciliación.',
                    }}
                    onReset={handleReset}
                    unifiedSearch={<UnifiedSearchBar
                        config={statementsUnifiedConfig}
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
                        filterOptions={search.filterOptions}
                        placeholder="Buscar cartola..."
                    />}
                    createAction={internalImportButton ?? createAction}
                    defaultPageSize={10}
                    renderLoadingView={renderLoadingView}
                    renderCustomView={renderCustomView}
                />
            </div>

            <StatementImportModal
                key={modalKey}
                open={importModalOpen}
                onOpenChange={handleModalChange}
                onSuccess={handleImportSuccess}
                defaultAccountId={search.filters.bank_account_id && search.filters.bank_account_id !== 'all' ? Number(search.filters.bank_account_id) : undefined}
                allowedAccountIds={accounts?.map(a => a.id)}
            />

            <Drawer
                open={!!workbenchStatementId}
                onOpenChange={(open) => { if (!open) closeWorkbench() }}
                title="Mesa de Conciliación"
                side="bottom"
                boundary="embedded"
                resizable={false}
                showOverlay={true}
                defaultSize="100%"
                contentClassName="p-0 flex flex-col overflow-hidden"
                headerActions={
                    workbenchStatement && workbenchStatement.reconciliation_progress === 100 && workbenchStatement.state !== 'CONFIRMED' ? (
                        <ActionSlideButton
                            onClick={() => confirmAction.requestConfirm()}
                            loading={confirmAction.isConfirming}
                            icon={CheckCircle2}
                            variant="success"
                            className="bg-success hover:bg-success/90 shadow-card px-5 font-bold text-sm"
                        >
                            {confirmAction.isConfirming ? 'Finalizando...' : 'Confirmar Cartola'}
                        </ActionSlideButton>
                    ) : undefined
                }
            >
                {workbenchStatementId && (
                    <div className="flex-1 p-4 overflow-hidden">
                        <ReconciliationPanel
                            statementId={workbenchStatementId}
                            treasuryAccountId={workbenchStatement?.treasury_account ?? 0}
                            onComplete={() => {
                                refetch()
                            }}
                        />
                    </div>
                )}
            </Drawer>

            <ActionConfirmModal
                open={confirmAction.isOpen}
                onOpenChange={(open) => { if (!open) confirmAction.cancel() }}
                onConfirm={confirmAction.confirm}
                title="Confirmar Cartola"
                description="¿Está seguro de confirmar esta cartola? Esto validará todas las conciliaciones, actualizará los saldos de la cuenta y bloqueará la cartola para futuras modificaciones."
                confirmText="Confirmar"
            />
        </div>
    )
}
