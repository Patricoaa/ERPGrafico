"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import React, { useState } from "react"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { AccountDrawer } from "@/features/finance"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { showApiError } from "@/lib/errors"
import { type Account } from "@/features/accounting/types"
import { accountActions, type AccountActionsCtx } from "./accountActions"
import { buildAccountTree } from "../utils/accountTree"
import { accountEntity, accountViews } from "../entity-view/account.entity"

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function AccountsClientView({ externalOpen, onExternalOpenChange, createAction }: AccountsClientViewProps) {
    const query = useCollectionQuery(accountEntity, { sorting: "client" })
    const { search } = query
    const { accounts: flatAccounts, isLoading, isError, refetch, archiveAccount } = useAccounts({ filters: query.params })
    const [archiveTarget, setArchiveTarget] = useState<Account | null>(null)
    const [formParentId, setFormParentId] = useState<string | null>(null)

    const accounts = React.useMemo(() => {
        if (flatAccounts.length > 0) {
            return buildAccountTree(flatAccounts)
        }
        return []
    }, [flatAccounts])

    const { openEntity } = useGlobalModals()
    // ADR-0152: cada cuenta abre su propia pestaña; esta pestaña de página solo crea (con cuenta padre).
    useDeepLinkEntity("accounting.account")
    const panel = useCreatePanelRoute({
        resolved: false,
        external: { open: externalOpen, onOpenChange: (open) => { onExternalOpenChange?.(open); if (!open) setFormParentId(null) } },
    })

    const confirmArchive = async () => {
        if (!archiveTarget) return
        const isArchiving = archiveTarget.is_active
        try {
            await archiveAccount({ id: archiveTarget.id, is_active: !archiveTarget.is_active })
            toast.success(`Cuenta ${isArchiving ? "archivada" : "restaurada"} correctamente`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"} la cuenta`)
        } finally {
            setArchiveTarget(null)
        }
    }

    const actionCtx = React.useMemo<AccountActionsCtx>(() => ({
        onEdit: (account) => openEntity("accounting.account", account.id, account),
        onArchive: (account) => setArchiveTarget(account),
    }), [openEntity])
    // Stable row callbacks: the fully expanded chart re-renders every row when they change.
    const rowActions = React.useMemo(() => accountActions.forCollection(actionCtx), [actionCtx])

    // The whole chart in one page (it is a tree: pages would split branches by top-level count).
    const collection = useEntityCollection(
        accountEntity,
        { rows: accounts, isLoading, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "none" }, sorting: query.sorting },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                actions={rowActions}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={accountViews.table}
                    emptyTitle="Aún no hay cuentas contables"
                    emptyDescription="El plan de cuentas se crea en la configuración inicial; también puedes agregar cuentas manualmente."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="accounting.account" {...panel.tab}>
                {(open) => (
                    <AccountDrawer
                        accounts={flatAccounts as unknown as Record<string, unknown>[]}
                        parentId={formParentId || undefined}
                        mode="create"
                        onSuccess={() => {
                            refetch()
                        }}
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={archiveTarget !== null}
                onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}
                title={archiveTarget?.is_active ? "Archivar Cuenta" : "Restaurar Cuenta"}
                variant={archiveTarget?.is_active ? "warning" : "default"}
                onConfirm={confirmArchive}
                confirmText={archiveTarget?.is_active ? "Archivar" : "Restaurar"}
                description={archiveTarget?.is_active
                    ? "¿Está seguro de archivar esta cuenta? Dejará de estar disponible para nuevas operaciones contables."
                    : "¿Está seguro de restaurar esta cuenta?"}
            />
        </div>
    )
}
