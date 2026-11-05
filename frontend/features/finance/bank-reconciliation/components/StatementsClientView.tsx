"use client"

import { EntityPanelTab } from "@/components/providers"
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Upload } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import type { BankStatement } from "../types"
import { StatementImportModal } from "@/features/finance"
import { useBanks } from "@/features/treasury"
import { UnifiedSearchBar, useUnifiedSearch, ActionConfirmModal } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { statementEntity, statementViews } from "@/features/finance"
import type { UnifiedSearchConfig, MultiSelectOption } from "@/types/unified-search"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useDeleteStatementMutation, useDownloadStatementFile } from "../hooks/useReconciliationMutations"
import { statementActions, type StatementActionsCtx } from "./statementActions"
import { Button } from "@/components/ui/button"

interface StatementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
    bankId?: number
    accounts?: Array<{ id: number; name: string; bank?: number | null }>
    detailBasePath?: string
}

export function StatementsClientView({ externalOpen = false, createAction, bankId, accounts }: StatementsClientViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const [importModalOpen, setImportModalOpen] = useState(false)
    const [modalKey, setModalKey] = useState(0)
    const [deletingStatement, setDeletingStatement] = useState<BankStatement | null>(null)
    const { openEntity, openWorkbench } = useGlobalModalActions()
    const deleteMutation = useDeleteStatementMutation()
    const { mutate: downloadFile } = useDownloadStatementFile()

    const bankParam = searchParams.get("bank")
    const showBankFilter = accounts !== undefined && !bankId
    const selectedBankId = showBankFilter && bankParam && !isNaN(Number(bankParam)) ? Number(bankParam) : undefined
    const { banks } = useBanks()

    const visibleAccounts = useMemo(
        () => selectedBankId && accounts
            ? accounts.filter((account) => account.bank === selectedBankId)
            : (accounts ?? []),
        [accounts, selectedBankId],
    )

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        bank: banks.map((bank) => ({ label: bank.name, value: String(bank.id) })),
        bank_account: visibleAccounts.map((a) => ({ label: a.name, value: String(a.id) })),
    }), [banks, visibleAccounts])

    const statementsUnifiedConfig = useMemo<UnifiedSearchConfig>(() => {
        const filters: NonNullable<UnifiedSearchConfig['filters']> = [
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
        ]
        if (showBankFilter) {
            filters.unshift({
                type: "single",
                key: "bank",
                label: "Banco",
                serverParam: "bank",
                dynamic: true,
            })
        }
        return {
            searchFields: [
                {
                    key: "display_id",
                    label: "Cartola",
                    serverParam: "search",
                    clientKey: ["display_id", "treasury_account_name"],
                },
            ],
            filters,
        }
    }, [showBankFilter])

    const search = useUnifiedSearch(statementsUnifiedConfig, filterOptions)
    const handleReset = useCallback(() => { search.clearAll() }, [search])

    const statementParams = useMemo<Record<string, string> | undefined>(() => {
        const params: Record<string, string> = {}
        if (search.filters.bank_account_id && search.filters.bank_account_id !== "all") {
            params.treasury_account = search.filters.bank_account_id
        } else {
            const bankFilter = bankId ? String(bankId) : search.filters.bank
            if (bankFilter) params.bank = bankFilter
        }
        return Object.keys(params).length > 0 ? params : undefined
    }, [search.filters.bank_account_id, search.filters.bank, bankId])

    const { data: statements = [], isLoading, refetch } = useStatementsQuery(statementParams)

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

    // Deep links (?selected= / ?workbench=) abren una pestaña una sola vez por valor: las pestañas
    // gestionan su propio ciclo de vida, así que no se reabren al cerrarlas.
    const openersRef = useRef({ openEntity, openWorkbench })
    useEffect(() => { openersRef.current = { openEntity, openWorkbench } }, [openEntity, openWorkbench])
    const selectedParam = searchParams.get("selected")
    const workbenchParam = searchParams.get("workbench")
    useEffect(() => {
        const numId = Number(selectedParam)
        if (selectedParam && !Number.isNaN(numId)) openersRef.current.openEntity("treasury.bankstatement", numId)
    }, [selectedParam])
    useEffect(() => {
        const numId = Number(workbenchParam)
        if (workbenchParam && !Number.isNaN(numId)) openersRef.current.openWorkbench(numId)
    }, [workbenchParam])

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

    const actionsCtx = useMemo<StatementActionsCtx>(() => ({
        onView: (stmt) => openEntity("treasury.bankstatement", stmt.id, undefined, undefined, { display: stmt.display_id }),
        onReconcile: (stmt) => openWorkbench(stmt.id, stmt.display_id),
        onDownload: (stmt) => downloadFile({ statementId: stmt.id, fileName: stmt.file_name ?? stmt.display_id }),
        onDelete: (stmt) => setDeletingStatement(stmt),
    }), [openEntity, openWorkbench, downloadFile])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 flex flex-col min-h-0">
                <Collection.Root
                    collection={collection}
                    onOpen={(stmt: BankStatement) => actionsCtx.onView(stmt)}
                    actions={statementActions.forCollection(actionsCtx)}
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

            <EntityPanelTab label="treasury.bankstatement" id={null} display="Importar extracto" open={importModalOpen} onClose={() => handleModalChange(false)}>
                {(open) => (
                    <StatementImportModal
                        key={modalKey}
                        open={open}
                        onOpenChange={handleModalChange}
                        onSuccess={handleImportSuccess}
                        defaultAccountId={search.filters.bank_account_id && search.filters.bank_account_id !== "all" ? Number(search.filters.bank_account_id) : undefined}
                        allowedAccountIds={accounts?.map((a) => a.id)}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={!!deletingStatement}
                onOpenChange={(open) => { if (!open) setDeletingStatement(null) }}
                onConfirm={async () => {
                    if (!deletingStatement) return
                    try {
                        await deleteMutation.mutateAsync(deletingStatement.id)
                    } finally {
                        setDeletingStatement(null)
                    }
                }}
                title={`Eliminar ${deletingStatement?.display_id ?? "cartola"}`}
                description="Se eliminará el borrador, sus líneas y el archivo original importado. No se puede deshacer."
                variant="destructive"
                confirmText="Eliminar"
            />
        </div>
    )
}
