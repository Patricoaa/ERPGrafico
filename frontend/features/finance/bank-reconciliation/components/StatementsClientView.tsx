"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Upload, Activity, CheckCircle2 } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import { useStatementQuery } from "../hooks/useReconciliationQueries"
import type { BankStatement } from "../types"
import { StatementImportModal, StatementDetailPanel, ReconciliationPanel } from "@/features/finance"
import { useConfirmStatement } from "@/features/treasury"
import { UnifiedSearchBar, useUnifiedSearch, Drawer, EmptyState, ActionConfirmModal, SubmitButton } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { statementEntity, statementViews } from "@/features/finance"
import type { UnifiedSearchConfig, MultiSelectOption } from "@/types/unified-search"
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
    const [detailStatementId, setDetailStatementId] = useState<number | null>(null)
    const [workbenchStatementId, setWorkbenchStatementId] = useState<number | null>(null)

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        bank_account: (accounts ?? []).map((a) => ({ label: a.name, value: String(a.id) })),
    }), [accounts])

    const statementsUnifiedConfig = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [
            {
                key: "display_id",
                label: "Cartola",
                serverParam: "search",
                clientKey: ["display_id", "treasury_account_name"],
            },
        ],
        filters: [
            {
                type: "single",
                key: "bank_account",
                label: "Cuenta Bancaria",
                serverParam: "bank_account_id",
                dynamic: true,
            },
            {
                type: "single",
                key: "state",
                label: "Estado",
                serverParam: "state",
                options: [
                    { label: "Borrador", value: "DRAFT" },
                    { label: "Confirmado", value: "CONFIRMED" },
                    { label: "Anulado", value: "CANCELLED" },
                ],
            },
        ],
    }), [])

    const search = useUnifiedSearch(statementsUnifiedConfig, filterOptions)
    const handleReset = useCallback(() => { search.clearAll() }, [search])

    const { data: statements = [], isLoading, refetch } = useStatementsQuery(
        search.filters.bank_account_id && search.filters.bank_account_id !== "all"
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

    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setImportModalOpen(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    useEffect(() => {
        const selectedId = searchParams.get("selected")
        if (selectedId) {
            const numId = Number(selectedId)
            if (!isNaN(numId)) {
                const handle = requestAnimationFrame(() => setDetailStatementId(numId))
                return () => cancelAnimationFrame(handle)
            }
        }
    }, [searchParams])

    useEffect(() => {
        const wbId = searchParams.get("workbench")
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
        setModalKey((k) => k + 1)
        if (accounts) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        } else {
            router.replace("/treasury/reconciliation")
        }
    }

    const handleModalChange = (open: boolean) => {
        setImportModalOpen(open)
        if (!open) {
            setModalKey((k) => k + 1)
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            const query = params.toString()
            if (accounts) {
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
            } else {
                router.replace("/treasury/reconciliation")
            }
        }
    }

    const openWorkbench = (stmtId: number) => {
        setWorkbenchStatementId(stmtId)
        const params = new URLSearchParams(searchParams.toString())
        params.set("workbench", String(stmtId))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeWorkbench = () => {
        setWorkbenchStatementId(null)
        const params = new URLSearchParams(searchParams.toString())
        params.delete("workbench")
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const collection = useEntityCollection(
        statementEntity,
        { rows: isLoading ? [] : filteredStatements },
        { pagination: { mode: "client", pageSize: 10 } },
    )

    const importButton = accounts !== undefined ? (
        <Button
            size="sm"
            onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("modal", "import")
                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                setImportModalOpen(true)
            }}
        >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Importar Cartola
        </Button>
    ) : undefined

    const statementActions = useCallback((stmt: BankStatement) =>
        stmt.state !== "CONFIRMED" && stmt.reconciliation_progress < 100 ? (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); openWorkbench(stmt.id) }}>
                <Activity className="h-3.5 w-3.5 mr-1" />
                Reconciliar
            </Button>
        ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

    // Workbench drawer state
    const { data: workbenchStatement } = useStatementQuery(workbenchStatementId ?? 0, !!workbenchStatementId)
    const confirmMutation = useConfirmStatement()
    const confirmAction = useConfirmAction(async () => {
        if (!workbenchStatementId) return
        try {
            await confirmMutation.mutateAsync(workbenchStatementId)
            toast.success("Cartola confirmada exitosamente")
            closeWorkbench()
            refetch()
        } catch (error: unknown) {
            showApiError(error, "Error al confirmar cartola")
        }
    })

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <Collection.Root
                    collection={collection}
                    onOpen={(stmt: BankStatement) => setDetailStatementId(stmt.id)}
                    actions={statementActions}
                >
                    <Collection.Toolbar action={importButton ?? createAction}>
                        <UnifiedSearchBar
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
                        />
                    </Collection.Toolbar>
                    <Collection.View
                        table={statementViews.table}
                        card={statementViews.card}
                        emptyTitle="No hay cartolas importadas"
                        emptyDescription="Importa una cartola bancaria para comenzar la conciliación."
                        onResetFilters={search.isFiltered ? handleReset : undefined}
                    />
                </Collection.Root>
            </div>

            {/* Statement detail drawer (replaces inline expansion) */}
            <Drawer
                open={!!detailStatementId}
                onOpenChange={(open) => { if (!open) setDetailStatementId(null) }}
                title="Detalle de Cartola"
                side="right"
                defaultSize={720}
            >
                {detailStatementId && (
                    <div className="p-4 overflow-y-auto h-full">
                        <StatementDetailPanel
                            statementId={detailStatementId}
                            bankId={bankId}
                            detailBasePath={detailBasePath}
                        />
                    </div>
                )}
            </Drawer>

            <StatementImportModal
                key={modalKey}
                open={importModalOpen}
                onOpenChange={handleModalChange}
                onSuccess={handleImportSuccess}
                defaultAccountId={search.filters.bank_account_id && search.filters.bank_account_id !== "all" ? Number(search.filters.bank_account_id) : undefined}
                allowedAccountIds={accounts?.map((a) => a.id)}
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
                    workbenchStatement && workbenchStatement.reconciliation_progress === 100 && workbenchStatement.state !== "CONFIRMED" ? (
                        <SubmitButton
                            onClick={() => confirmAction.requestConfirm()}
                            loading={confirmAction.isConfirming}
                            icon={CheckCircle2}
                            className="bg-success hover:bg-success/90 shadow-card px-5 font-bold text-sm"
                        >
                            {confirmAction.isConfirming ? "Finalizando..." : "Confirmar Cartola"}
                        </SubmitButton>
                    ) : undefined
                }
            >
                {workbenchStatementId && (
                    <div className="flex-1 p-4 overflow-hidden">
                        <ReconciliationPanel
                            statementId={workbenchStatementId}
                            treasuryAccountId={workbenchStatement?.treasury_account ?? 0}
                            onComplete={() => { refetch() }}
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
