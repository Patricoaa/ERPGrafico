"use client"

import React, { useState } from "react"
import {
    type ColumnDef
} from "@tanstack/react-table"
import { ActionConfirmModal, DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { IconButton } from "@/components/shared"

import { AccountDrawer } from "@/features/finance"
import { LedgerDrawer } from "@/features/accounting/components/LedgerDrawer"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { type Account } from "@/features/accounting/types"
import { DataCell } from '@/components/shared'
import { accountActions, type AccountActionsCtx } from './accountActions'
import { accountFields } from "../accountFields"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronRight, ChevronDown } from "lucide-react"
import { buildAccountTree } from "../utils/accountTree"

import { ActivitySidebar } from "@/features/audit"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { accountUnifiedSearchDef } from "../unifiedSearchDef"

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function AccountsClientView({ externalOpen, onExternalOpenChange, createAction }: AccountsClientViewProps) {
    const search = useUnifiedSearch(accountUnifiedSearchDef)
    const { accounts: flatAccounts, isLoading, refetch, deleteAccount } = useAccounts({ filters: search.filters as unknown as Record<string, unknown> })
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [formParentId, setFormParentId] = useState<string | null>(null)
    const [ledgerTarget, setLedgerTarget] = useState<{ id: number; name: string; code: string } | null>(null)

    const accounts = React.useMemo(() => {
        if (flatAccounts.length > 0) {
            return buildAccountTree(flatAccounts)
        }
        return []
    }, [flatAccounts])

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Account>({
        endpoint: '/accounting/accounts'
    })

    const isCreateOpen = searchParams.get("modal") === "new" || externalOpen
    const isFormOpen = isCreateOpen || !!selectedFromUrl
    const editingAccount = selectedFromUrl ?? null

    const handleCloseModal = () => {
        setFormParentId(null)
        onExternalOpenChange?.(false)
        clearSelection()
        if (isCreateOpen) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteAccount(deleteTarget)
        } catch (error) {
            console.error("Failed to delete account", error)
        } finally {
            setDeleteTarget(null)
        }
    }

    const columns: ColumnDef<Account>[] = React.useMemo(() => {
        const actionCtx: AccountActionsCtx = {
            onViewLedger: (account) => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('ledger_account', String(account.id))
                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                setLedgerTarget({ id: account.id, name: account.name, code: account.code })
            },
            onEdit: (account) => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('selected', String(account.id))
                router.push(`${pathname}?${params.toString()}`, { scroll: false })
            },
            onDelete: (id) => setDeleteTarget(id),
        }
        return [
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código" className="justify-center" />
            ),
            cell: ({ row }) => {
                const canExpand = row.getCanExpand()
                const isExpanded = row.getIsExpanded()

                return (
                    <div
                        className="flex items-center w-full"
                        style={{ paddingLeft: `${row.depth * 1.5}rem` }}
                    >
                        <div className="flex items-center gap-2 flex-1 justify-center relative translate-x-[0.75rem]">
                            {canExpand ? (
                                <IconButton
                                    circular
                                    className="h-4 w-4 p-0 hover:bg-transparent absolute -left-6"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        row.toggleExpanded()
                                    }}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </IconButton>
                            ) : (
                                <div className="w-4 h-4 absolute -left-6" />
                            )}
                            <DataCell.Code>{row.original.code}</DataCell.Code>
                        </div>
                    </div>
                )
            },
            meta: { title: "Código" },
        },
        ...accountFields.toColumns({ exclude: ["code"] }),
        accountActions.auto(actionCtx),
        ]
    }, [pathname, router, searchParams])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={accounts}
                    isLoading={isLoading}
                    variant="embedded"
                    defaultPageSize={500}
                    getSubRows={(row: Account & { children?: unknown[] }) => row.children as (Account & { children?: unknown[] })[] | undefined}
                    autoExpand={true}
                    createAction={createAction}
                    unifiedSearch={<UnifiedSearchBar
                        config={accountUnifiedSearchDef}
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
                        placeholder="Buscar por cuenta o código..."
                    />}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay cuentas contables",
                        description: "El plan de cuentas se crea en la configuración inicial; también puedes agregar cuentas manualmente.",
                    }}
                />
            </div>

            <AccountDrawer
                accounts={flatAccounts as unknown as Record<string, unknown>[]}
                initialData={editingAccount as unknown as Record<string, unknown>}
                parentId={formParentId || undefined}
                auditSidebar={
                    editingAccount ? (
                        <ActivitySidebar entityId={editingAccount.id} entityType="account" />
                    ) : undefined
                }
                mode="create"
                onSuccess={() => {
                    refetch()
                }}
                open={isFormOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    }
                }}
            />

            {ledgerTarget && (
                <LedgerDrawer
                    accountId={ledgerTarget.id}
                    accountName={ledgerTarget.name}
                    accountCode={ledgerTarget.code}
                    noTrigger
                />
            )}

            <ActionConfirmModal
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                title="Eliminar Cuenta"
                variant="destructive"
                onConfirm={confirmDelete}
                confirmText="Eliminar"
                description="¿Está seguro de eliminar esta cuenta? Esta acción no se puede deshacer."
            />
        </div>
    )
}
