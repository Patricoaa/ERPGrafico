"use client"

import React, { useState, useEffect, useRef } from "react"
import {
    type ColumnDef
} from "@tanstack/react-table"
import { ActionConfirmModal, DataTable, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { IconButton } from "@/components/shared"

import { AccountDrawer } from "@/features/finance"
import { LedgerDrawer } from "@/features/accounting/components/LedgerDrawer"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { type Account } from "@/features/accounting/types"
import { DataCell } from '@/components/shared'
import { accountActions, type AccountActionsCtx } from './accountActions'

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronRight, ChevronDown } from "lucide-react"
import { buildAccountTree } from "../utils/accountTree"

import { ActivitySidebar } from "@/features/audit"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { accountSearchDef } from "../searchDef"
import { accountSegDef } from "../segmentationDef"

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function AccountsClientView({ externalOpen, onExternalOpenChange, createAction }: AccountsClientViewProps) {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(accountSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(accountSegDef)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = { ...textFilters, ...segFilters }
    const { accounts: flatAccounts, isLoading, refetch, deleteAccount } = useAccounts({ filters: allFilters as unknown as Record<string, unknown> })
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [formParentId, setFormParentId] = useState<string | null>(null)
    const [ledgerTarget, setLedgerTarget] = useState<{ id: number; name: string; code: string } | null>(null)

    // Guard for async operations during mount/unmount
    const isMounted = useRef(false)

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

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

    // Open edit form if ?selected= is present (ADR-0020).
    // Depends ONLY on selectedFromUrl — see CategoryList for explanation
    // of why isFormOpen/editingAccount must NOT be in the dependency array.
    useEffect(() => {
        requestAnimationFrame(() => {
            if (selectedFromUrl) {
                setEditingAccount(selectedFromUrl)
                setIsFormOpen(true)
            } else {
                setIsFormOpen(false)
                setEditingAccount(null)
            }
        })
    }, [selectedFromUrl])

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingAccount(null)
        setFormParentId(null)
        onExternalOpenChange?.(false)
        clearSelection()
    }



    const handleEditAccount = React.useCallback((account: Account) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(account.id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [pathname, router, searchParams])

    // Synchronize external modal trigger
    useEffect(() => {
        if (externalOpen && isMounted.current) {
            requestAnimationFrame(() => setIsFormOpen(true))
        }
    }, [externalOpen])



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
            onEdit: handleEditAccount,
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
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text>{row.original.name}</DataCell.Text></div>,
        },
        {
            accessorKey: "account_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge
                        status={row.original.account_type}
                        label={row.original.account_type_display}
                    />
                </div>
            ),
        },
        {
            accessorKey: "debit_total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Debe" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={parseFloat(row.getValue("debit_total") || "0")}
                    />
                </div>
            ),
        },
        {
            accessorKey: "credit_total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Haber" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={parseFloat(row.getValue("credit_total") || "0")}
                    />
                </div>
            ),
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={parseFloat(row.getValue("balance") || "0")}
                    />
                </div>
            ),
        },
        accountActions.column(actionCtx),
        ]
    }, [handleEditAccount, pathname, router, searchParams])

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
                    smartSearch={<SmartSearchBar searchDef={accountSearchDef} placeholder="Buscar por cuenta o código..." className="w-full" />}
                    segmentation={<SegmentationBar def={accountSegDef} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    isFiltered={isFiltered}
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
