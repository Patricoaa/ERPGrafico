"use client"

import { useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { useTreasuryAccounts, type TreasuryAccount, treasuryAccountActions, type TreasuryAccountActionsCtx } from "@/features/treasury"
import { ActionConfirmModal } from '@/components/shared'
import { showApiError } from "@/lib/errors"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { treasuryAccountEntity, treasuryAccountViews } from "../entity-view/treasuryAccount.entity"

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankCenterClientView, PaymentMethodClientView } from "@/features/treasury"
import { TreasuryAccountWizard } from "./TreasuryAccountWizard"

import { FadeIn } from '@/components/shared'

import { useRouter, usePathname, useSearchParams } from "next/navigation"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */


interface TreasuryAccountsClientViewProps {
    activeTab: string
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export const TreasuryAccountsClientView: React.FC<TreasuryAccountsClientViewProps> = ({ activeTab, externalOpen, createAction }) => {
    const query = useCollectionQuery(treasuryAccountEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { accounts, isLoading, isRefetching, isError, archiveAccount, refetch } = useTreasuryAccounts({ filters: query.params })
    const { view, onViewChange } = useCollectionViewMode("treasury.treasuryaccount")
    const [archiveTarget, setArchiveTarget] = useState<TreasuryAccount | null>(null)
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
    const [isLocalAccountModalOpen, setIsLocalAccountModalOpen] = useState(false)


    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { openEntity } = useGlobalModals()
    // ADR-0152: cada cuenta abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("treasury.treasuryaccount")

    const handleCloseModal = () => {
        setIsBankModalOpen(false)
        setIsMethodModalOpen(false)
        setIsLocalAccountModalOpen(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleEdit = (account: TreasuryAccount) => openEntity("treasury.treasuryaccount", account.id, account)

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

    const collection = useEntityCollection(
        treasuryAccountEntity,
        { rows: accounts, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )

    return (
        <>
        <Tabs value={activeTab} className="flex-1 min-h-0 flex flex-col">
            <TabsContent value="accounts" className="flex-1 min-h-0 flex flex-col">
                <Collection.Root
                    collection={collection}
                    query={query}
                    view={view}
                    onViewChange={onViewChange}
                    actions={treasuryAccountActions.forCollection(actionsCtx)}
                >
                    <Collection.Toolbar action={activeTab === "accounts" ? createAction : undefined} />
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
