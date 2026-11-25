"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Upload } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import type { BankStatement } from "../types"
import { StatementImportModal } from "@/features/finance"
import { useBanks, useTreasuryAccounts } from "@/features/treasury"
import { ActionConfirmModal } from "@/components/shared"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { statementEntity, statementViews } from "@/features/finance"
import type { MultiSelectOption } from "@/types/unified-search"
import { bankStatementQueryEntity } from "../entity-view/statement.entity"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useDeleteStatementMutation, useDownloadStatementFile } from "../hooks/useReconciliationMutations"
import { statementActions, type StatementActionsCtx } from "./statementActions"
import { Button } from "@/components/ui/button"

interface StatementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
    /** Sin banco: vista de todos los bancos. Con banco: sus cuentas corrientes (mismo componente). */
    bankId?: number
}

export function StatementsClientView({ externalOpen = false, createAction, bankId }: StatementsClientViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const [importModalOpen, setImportModalOpen] = useState(false)
    const [modalKey, setModalKey] = useState(0)
    const [deletingStatement, setDeletingStatement] = useState<BankStatement | null>(null)
    const { openEntity, openWorkbench } = useGlobalModalActions()
    const deleteMutation = useDeleteStatementMutation()
    const { mutate: downloadFile } = useDownloadStatementFile()

    // Cuentas corrientes en alcance: todas, o solo las del banco. Las cartolas se acotan a estas cuentas.
    const { accounts: checkingAccounts } = useTreasuryAccounts({ filters: { account_type: "CHECKING" } })
    const accounts = useMemo(
        () => checkingAccounts
            .filter((account) => !bankId || account.bank === bankId)
            .map((account) => ({ id: account.id, name: account.name, bank: account.bank ?? null })),
        [checkingAccounts, bankId],
    )
    const accountIds = useMemo(() => new Set(accounts.map((account) => account.id)), [accounts])
    const showBankFilter = !bankId
    // El filtro de banco vive en la URL (`?bank=`); se lee antes de la barra para acotar las cuentas.
    const bankParam = searchParams.get("bank")
    const selectedBankId = showBankFilter && bankParam && !isNaN(Number(bankParam)) ? Number(bankParam) : undefined
    const { banks } = useBanks()

    const visibleAccounts = useMemo(
        () => selectedBankId
            ? accounts.filter((account) => account.bank === selectedBankId)
            : accounts,
        [accounts, selectedBankId],
    )

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        bank: banks.map((bank) => ({ label: bank.name, value: String(bank.id) })),
        treasury_account: visibleAccounts.map((a) => ({ label: a.name, value: String(a.id) })),
    }), [banks, visibleAccounts])

    const query = useCollectionQuery(showBankFilter ? statementEntity : bankStatementQueryEntity, { filterOptions, sorting: "client" })
    const { search, params, groupBy } = query
    const handleReset = useCallback(() => { search.clearAll() }, [search])
    const selectedAccountId = params.treasury_account && params.treasury_account !== "all" ? Number(params.treasury_account) : undefined

    const statementParams = useMemo<Record<string, string> | undefined>(() => {
        const serverParams: Record<string, string> = {}
        if (selectedAccountId) {
            serverParams.treasury_account = String(selectedAccountId)
        } else {
            const bankFilter = bankId ? String(bankId) : params.bank
            if (bankFilter) serverParams.bank = bankFilter
        }
        return Object.keys(serverParams).length > 0 ? serverParams : undefined
    }, [selectedAccountId, params.bank, bankId])

    const { data: statements = [], isLoading, refetch } = useStatementsQuery(statementParams)

    // Banco y cuenta ya los acota el servidor (las filas no traen esas claves: `filterFn` las vaciaría).
    const filteredStatements = useMemo(() => {
        const text = params.search?.toLowerCase()
        return statements.filter((s) =>
            accountIds.has(s.treasury_account) &&
            (!params.state || s.state === params.state) &&
            (!text || s.display_id.toLowerCase().includes(text) || s.treasury_account_name.toLowerCase().includes(text)),
        )
    }, [statements, params.search, params.state, accountIds])

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
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const handleModalChange = (open: boolean) => {
        setImportModalOpen(open)
        if (!open) {
            setModalKey((k) => k + 1)
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }

    const collection = useEntityCollection(
        statementEntity,
        { rows: isLoading ? [] : filteredStatements, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 10 }, sorting: query.sorting, groupBy },
    )

    const importButton = (
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
    )

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
                    query={query}
                    onOpen={(stmt: BankStatement) => actionsCtx.onView(stmt)}
                    actions={statementActions.forCollection(actionsCtx)}
                >
                    <Collection.Toolbar action={importButton ?? createAction} />
                    <Collection.View
                        table={statementViews.table}
                        card={statementViews.card}
                        emptyTitle="No hay cartolas importadas"
                        emptyDescription="Importa una cartola bancaria para comenzar la conciliación."
                        onResetFilters={search.isFiltered ? handleReset : undefined}
                    />
                </Collection.Root>
            </div>

            <StatementImportModal
                key={modalKey}
                open={importModalOpen}
                onOpenChange={handleModalChange}
                onSuccess={handleImportSuccess}
                defaultAccountId={selectedAccountId}
                allowedAccountIds={accounts.map((a) => a.id)}
            />

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
