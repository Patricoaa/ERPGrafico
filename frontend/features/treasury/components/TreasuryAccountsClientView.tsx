"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryAccountActions, type TreasuryAccountActionsCtx } from "@/features/treasury"
import { AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { treasuryAccountUnifiedSearchDef } from "../unifiedSearchDef"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView } from '@/components/shared'

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankCenterClientView, PaymentMethodClientView } from "@/features/treasury"
import { TreasuryAccountWizard } from "./TreasuryAccountWizard"

import { TreasuryAccountDrawer } from "./TreasuryAccountDrawer"
import { FadeIn } from '@/components/shared'
import { accountFields } from "../accountFields"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { Wallet, Landmark, CreditCard, HandCoins, ArrowRightLeft, FileText, type LucideIcon } from "lucide-react"


interface TreasuryAccountsClientViewProps {
    activeTab: string
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export const TreasuryAccountsClientView: React.FC<TreasuryAccountsClientViewProps> = ({ activeTab, externalOpen, createAction }) => {
    const search = useUnifiedSearch(treasuryAccountUnifiedSearchDef)
    const { accounts, isLoading, deleteAccount, refetch } = useTreasuryAccounts({ filters: search.filters })
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

    const accountTypeIcons: Record<string, LucideIcon> = {
        CASH: Wallet,
        CHECKING: Landmark,
        CREDIT_CARD: CreditCard,
        LOAN: HandCoins,
        BRIDGE: ArrowRightLeft,
        CHECK_PORTFOLIO: FileText,
        ISSUED_CHECKS: FileText,
    }

    const accountTypeIconStyles: Record<string, string> = {
        CASH: "text-success bg-success/10",
        CHECKING: "text-info bg-info/10",
        CREDIT_CARD: "text-warning bg-warning/10",
        LOAN: "text-destructive bg-destructive/10",
        BRIDGE: "text-primary bg-primary/10",
        CHECK_PORTFOLIO: "text-muted-foreground bg-muted/50",
        ISSUED_CHECKS: "text-warning bg-warning/10",
    }

    const actionsCtx: TreasuryAccountActionsCtx = {
        onEdit: (item) => handleEdit(item),
        onDelete: (id) => handleDelete(id),
    }

    const columns = useMemo<ColumnDef<TreasuryAccount>[]>(() => [
        ...accountFields.toColumns(),
        treasuryAccountActions.auto(actionsCtx),
    ], [])

    return (
        <>
        <Tabs value={activeTab} className="flex-1 min-h-0 flex flex-col">
            <TabsContent value="accounts" className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0">
                        <DataTableView
                            entityLabel="treasury.treasuryaccount"
                            columns={columns}
                            data={accounts}
                            isLoading={isLoading}
                            variant="embedded"
                            cardSkeleton={{ showBody: false }}
                            createAction={activeTab === "accounts" ? createAction : undefined}
                            unifiedSearch={<UnifiedSearchBar
                                config={treasuryAccountUnifiedSearchDef}
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
                                placeholder="Buscar cuenta..."
                            />}
                            unifiedSearchConfig={treasuryAccountUnifiedSearchDef}
                            currentGroupBy={search.groupBy}
                            showReset={search.isFiltered}
                            onReset={search.clearAll}
                            isFiltered={search.isFiltered}
                            emptyState={{
                                context: "treasury",
                                title: "Aún no hay cuentas de tesorería",
                                description: "Crea cuentas de caja o banco para registrar y controlar tus fondos.",
                            }}
                            renderCard={(acc: TreasuryAccount) => {
                                const typeKey = acc.account_type?.toUpperCase()
                                const Icon = accountTypeIcons[typeKey]
                                const iconStyle = accountTypeIconStyles[typeKey]
                                return (
                                    <AutoEntityCard 
                                        key={acc.id} 
                                        data={acc}
                                        fields={accountFields}
                                        entityLabel="treasury.treasuryaccount"
                                        title={acc.name}
                                        onClick={() => handleEdit(acc)} 
                                        defaultAction={treasuryAccountActions.defaultAction(actionsCtx)?.(acc) ?? null}
                                        icon={Icon}
                                        iconClassName={iconStyle}
                                        actions={treasuryAccountActions.render(acc, actionsCtx)}

                                    />
                                )
                            }}
                        />
                    </div>
                </div>
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
