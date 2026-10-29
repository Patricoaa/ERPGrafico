"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { useTreasuryAccounts, type TreasuryAccount, treasuryAccountActions, type TreasuryAccountActionsCtx } from "@/features/treasury"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, ActionConfirmModal } from '@/components/shared'
import { showApiError } from "@/lib/errors"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { treasuryAccountUnifiedSearchDef } from "../unifiedSearchDef"
import { treasuryAccountEntity, treasuryAccountViews } from "../entity-view/treasuryAccount.entity"

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankCenterClientView, PaymentMethodClientView } from "@/features/treasury"
import { TreasuryAccountWizard } from "./TreasuryAccountWizard"

import { TreasuryAccountDrawer } from "./TreasuryAccountDrawer"
import { FadeIn } from '@/components/shared'

import { useRouter, usePathname, useSearchParams } from "next/navigation"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ACCOUNT_GROUPS: Record<string, FieldId<typeof treasuryAccountEntity.fields>> = { account_type: "accountType" }


interface TreasuryAccountsClientViewProps {
    activeTab: string
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export const TreasuryAccountsClientView: React.FC<TreasuryAccountsClientViewProps> = ({ activeTab, externalOpen, createAction }) => {
    const search = useUnifiedSearch(treasuryAccountUnifiedSearchDef)
    const { accounts, isLoading, isRefetching, isError, archiveAccount, refetch } = useTreasuryAccounts({ filters: search.filters })
    const { view, onViewChange } = useCollectionViewMode("treasury.treasuryaccount")
    const [archiveTarget, setArchiveTarget] = useState<TreasuryAccount | null>(null)
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
    const [isLocalAccountModalOpen, setIsLocalAccountModalOpen] = useState(false)


    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const panel = useEntityPanelRoute<TreasuryAccount>({ endpoint: '/treasury/accounts', create: false })

    const handleCloseModal = () => {
        setIsBankModalOpen(false)
        setIsMethodModalOpen(false)
        setIsLocalAccountModalOpen(false)
        panel.close()

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleEdit = (account: TreasuryAccount) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(account.id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleExternalAction = () => {
        switch (activeTab) {
            case "accounts":
                setIsLocalAccountModalOpen(true)
                break
            case "banks":
                setIsBankModalOpen(true)
                break
            case "methods":
                setIsMethodModalOpen(true)
                break
        }
    }

    // T-105: cancelAnimationFrame cleanup prevents setState on unmounted component
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => handleExternalAction())
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

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

    const actionsCtx: TreasuryAccountActionsCtx = {
        onEdit: (item) => handleEdit(item),
        onArchive: (item) => setArchiveTarget(item),
    }

    const groupBy = search.groupBy ? ACCOUNT_GROUPS[search.groupBy] ?? null : null
    const collection = useEntityCollection(
        treasuryAccountEntity,
        { rows: accounts, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )

    return (
        <>
        <Tabs value={activeTab} className="flex-1 min-h-0 flex flex-col">
            <TabsContent value="accounts" className="flex-1 min-h-0 flex flex-col">
                <Collection.Root
                    collection={collection}
                    view={view}
                    onViewChange={onViewChange}
                    onOpen={(acc) => handleEdit(acc)}
                    actions={treasuryAccountActions.forCollection(actionsCtx)}
                >
                    <Collection.Toolbar action={activeTab === "accounts" ? createAction : undefined}>
                        <UnifiedSearchBar config={treasuryAccountUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar cuenta..." />
                    </Collection.Toolbar>
                    <Collection.View
                        table={treasuryAccountViews.table}
                        card={treasuryAccountViews.card}
                        emptyTitle="Aún no hay cuentas de tesorería"
                        emptyDescription="Crea cuentas de caja o banco para registrar y controlar tus fondos."
                        emptyAction={activeTab === "accounts" ? createAction : undefined}
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>
            </TabsContent>

            <TabsContent value="banks" className="flex-1 min-h-0 flex flex-col">
                <FadeIn className="h-full">
                    <BankCenterClientView
                        externalOpen={isBankModalOpen || (activeTab === "banks" && !!externalOpen)}
                        onOpenChange={(open) => {
                            if (!open) {
                                handleCloseModal()
                            } else {
                                setIsBankModalOpen(true)
                            }
                        }}
                        createAction={activeTab === "banks" ? createAction : undefined}
                    />
                </FadeIn>
            </TabsContent>

            <TabsContent value="methods" className="flex-1 min-h-0 flex flex-col">
                <FadeIn className="h-full">
                    <PaymentMethodClientView
                        externalOpen={isMethodModalOpen || (activeTab === "methods" && !!externalOpen)}
                        onOpenChange={(open) => {
                            if (!open) {
                                handleCloseModal()
                            } else {
                                setIsMethodModalOpen(true)
                            }
                        }}
                        createAction={activeTab === "methods" ? createAction : undefined}
                    />
                </FadeIn>
            </TabsContent>

        </Tabs>

        <ActionConfirmModal
            open={archiveTarget !== null}
            onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}
            title={archiveTarget?.is_active ? "Archivar Cuenta de Tesorería" : "Restaurar Cuenta de Tesorería"}
            variant={archiveTarget?.is_active ? "warning" : "default"}
            onConfirm={confirmArchive}
            confirmText={archiveTarget?.is_active ? "Archivar" : "Restaurar"}
            description={archiveTarget?.is_active
                ? "¿Está seguro de archivar esta cuenta? Dejará de estar disponible para nuevas operaciones de tesorería."
                : "¿Está seguro de restaurar esta cuenta de tesorería?"}
        />

        <EntityPanelTab label="treasury.treasuryaccount" {...panel.tab}>
            {(open) => (
                <TreasuryAccountDrawer
                    accountId={panel.selectedId}
                    open={open}
                    onOpenChange={(open) => { if (!open) panel.close() }}
                    onSuccess={() => {
                        panel.close()
                        refetch()
                    }}
                />
            )}
        </EntityPanelTab>

        <TreasuryAccountWizard
            open={isLocalAccountModalOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setIsLocalAccountModalOpen(false)
                    if (searchParams.get("modal")) {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete("modal")
                        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                    }
                }
            }}
            onSuccess={() => {
                setIsLocalAccountModalOpen(false)
                refetch()
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }}
        />
        </>
    )
}

export default TreasuryAccountsClientView
