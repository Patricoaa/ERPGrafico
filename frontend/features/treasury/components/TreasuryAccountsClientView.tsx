"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryAccountActions, type TreasuryAccountActionsCtx } from "@/features/treasury"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { treasuryAccountUnifiedSearchDef } from "../unifiedSearchDef"
import { treasuryAccountEntity, treasuryAccountViews } from "../entity-view/treasuryAccount.entity"

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankCenterClientView, PaymentMethodClientView } from "@/features/treasury"
import { TreasuryAccountWizard } from "./TreasuryAccountWizard"

import { TreasuryAccountDrawer } from "./TreasuryAccountDrawer"
import { FadeIn } from '@/components/shared'

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ACCOUNT_GROUPS: Record<string, FieldId<typeof treasuryAccountEntity.fields>> = { account_type: "accountType" }


interface TreasuryAccountsClientViewProps {
    activeTab: string
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export const TreasuryAccountsClientView: React.FC<TreasuryAccountsClientViewProps> = ({ activeTab, externalOpen, createAction }) => {
    const search = useUnifiedSearch(treasuryAccountUnifiedSearchDef)
    const { accounts, isLoading, isRefetching, isError, deleteAccount, refetch } = useTreasuryAccounts({ filters: search.filters })
    const { view, onViewChange } = useCollectionViewMode("treasury.treasuryaccount")
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
    const [isLocalAccountModalOpen, setIsLocalAccountModalOpen] = useState(false)


    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryAccount>({
        endpoint: '/treasury/accounts'
    })

    const detailsOpen = !!selectedFromUrl
    const selectedAccountId = selectedFromUrl?.id ?? null

    const handleCloseModal = () => {
        setIsBankModalOpen(false)
        setIsMethodModalOpen(false)
        setIsLocalAccountModalOpen(false)
        clearSelection()

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

    const handleDelete = async (id: number) => {
        try {
            await deleteAccount(id)
        } catch {
            // Error already handled by hook
        }
    }

    const actionsCtx: TreasuryAccountActionsCtx = {
        onEdit: (item) => handleEdit(item),
        onDelete: (id) => handleDelete(id),
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

        <TreasuryAccountDrawer
            accountId={selectedAccountId}
            open={detailsOpen}
            onOpenChange={(open) => {
                if (!open) clearSelection()
            }}
            onSuccess={() => {
                clearSelection()
                refetch()
            }}
        />

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
