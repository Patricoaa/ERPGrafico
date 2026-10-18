"use client"

import React, { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { AccountDrawer } from "@/features/finance"
import { LedgerDrawer } from "@/features/accounting/components/LedgerDrawer"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { type Account } from "@/features/accounting/types"
import { ActivitySidebar } from "@/features/audit"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { accountActions, type AccountActionsCtx } from "./accountActions"
import { buildAccountTree } from "../utils/accountTree"
import { accountUnifiedSearchDef } from "../unifiedSearchDef"
import { accountEntity, accountViews } from "../entity-view/account.entity"

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function AccountsClientView({ externalOpen, onExternalOpenChange, createAction }: AccountsClientViewProps) {
    const search = useUnifiedSearch(accountUnifiedSearchDef)
    const { accounts: flatAccounts, isLoading, isError, refetch, deleteAccount } = useAccounts({ filters: search.filters as unknown as Record<string, unknown> })
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

    const actionCtx = React.useMemo<AccountActionsCtx>(() => ({
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
    }), [router, pathname, searchParams])
    // Stable row callbacks: the fully expanded chart re-renders every row when they change.
    const rowActions = React.useMemo(() => accountActions.forCollection(actionCtx), [actionCtx])

    // The whole chart in one page (it is a tree: pages would split branches by top-level count).
    const collection = useEntityCollection(
        accountEntity,
        { rows: accounts, isLoading, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "none" } },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                onOpen={actionCtx.onEdit}
                actions={rowActions}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={accountUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar por cuenta o código..." />
                </Collection.Toolbar>
                <Collection.View
                    table={accountViews.table}
                    emptyTitle="Aún no hay cuentas contables"
                    emptyDescription="El plan de cuentas se crea en la configuración inicial; también puedes agregar cuentas manualmente."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

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
