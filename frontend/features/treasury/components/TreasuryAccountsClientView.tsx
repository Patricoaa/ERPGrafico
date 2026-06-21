"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryAccountActions, type TreasuryAccountActionsCtx } from "@/features/treasury"
import { EntityCard, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from '@/components/shared'
import { treasuryAccountSearchDef } from "../searchDef"
import { treasuryAccountSegDef } from "../segmentationDef"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankManagement, PaymentMethodManagement } from "@/features/treasury"
import { TreasuryAccountWizard } from "./TreasuryAccountWizard"

import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { DataCell, FadeIn, EntityBadge } from '@/components/shared'

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { Wallet, Landmark, CreditCard, HandCoins, ArrowRightLeft, FileText, type LucideIcon } from "lucide-react"


interface TreasuryAccountsClientViewProps {
    activeTab: string
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export const TreasuryAccountsClientView: React.FC<TreasuryAccountsClientViewProps> = ({ activeTab, externalOpen, createAction }) => {
    const { openEntity } = useGlobalModalActions()
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(treasuryAccountSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(treasuryAccountSegDef)
    const isFiltered = isTextFiltered || isSegFiltered
    const accountsFilters = { ...textFilters, ...segFilters }
    const { accounts, isLoading, deleteAccount, refetch } = useTreasuryAccounts({ filters: accountsFilters })
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
    const [isLocalAccountModalOpen, setIsLocalAccountModalOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryAccount>({
        endpoint: '/treasury/accounts'
    })

    useEffect(() => {
        if (selectedFromUrl) {
            openEntity('treasury.treasuryaccount', selectedFromUrl.id, selectedFromUrl)
        }
    }, [selectedFromUrl, openEntity])

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

    const typeLabels: Record<string, string> = {
        CASH: "Caja Física (Efectivo)",
        CHECKING: "Cuenta Bancaria",
        CREDIT_CARD: "T. Crédito Empresa",
        LOAN: "Préstamo Bancario",
        BRIDGE: "Puente",
        CHECK_PORTFOLIO: "Cheques en Cartera",
    }

    const accountTypeIcons: Record<string, LucideIcon> = {
        CASH: Wallet,
        CHECKING: Landmark,
        CREDIT_CARD: CreditCard,
        LOAN: HandCoins,
        BRIDGE: ArrowRightLeft,
        CHECK_PORTFOLIO: FileText,
    }

    const accountTypeIconStyles: Record<string, string> = {
        CASH: "text-success bg-success/10",
        CHECKING: "text-info bg-info/10",
        CREDIT_CARD: "text-warning bg-warning/10",
        LOAN: "text-destructive bg-destructive/10",
        BRIDGE: "text-primary bg-primary/10",
        CHECK_PORTFOLIO: "text-muted-foreground bg-muted/50",
    }

    const actionsCtx: TreasuryAccountActionsCtx = {
        onEdit: (item) => handleEdit(item),
        onDelete: (id) => handleDelete(id),
    }

    const columns: ColumnDef<TreasuryAccount>[] = [
        {
            accessorKey: "name",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Nombre de Cuenta" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>
                        {row.original.name}
                    </DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "account_type_display",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Tipología" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>
                        {row.original.account_type_display || typeLabels[row.original.account_type] || row.original.account_type}
                    </DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "account_name",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Cuenta Contable" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const name = row.original.account_name
                if (!name) return <DataCell.Secondary className="italic text-center">No vinculada</DataCell.Secondary>
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <DataCell.Code>{row.original.account_code}</DataCell.Code>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DataCell.Secondary>{name}</DataCell.Secondary>
                            </TooltipTrigger>
                            <TooltipContent side="top">{row.original.account_code || ''} - {name}</TooltipContent>
                        </Tooltip>
                    </div>
                )
            }
        },
        {
            accessorKey: "bank",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Entidad Externa" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const bankId = row.original.bank
                const bankName = row.original.bank_name
                const providers = row.original.terminal_providers ?? []
                const hasBank = !!bankId
                const hasProviders = providers.length > 0
                if (!hasBank && !hasProviders) {
                    return (
                        <div className="flex justify-center w-full">
                            <DataCell.Secondary className="italic">Sin entidad externa</DataCell.Secondary>
                        </div>
                    )
                }
                return (
                    <div className="flex flex-col items-center justify-center gap-1 w-full">
                        {hasBank && (
                            <EntityBadge
                                label="treasury.bank"
                                data={{ id: bankId, name: bankName }}
                                size="sm"
                                showIcon
                            />
                        )}
                        {providers.map((p: NonNullable<TreasuryAccount['terminal_providers']>[number]) => (
                            <EntityBadge
                                key={p.id}
                                label="treasury.terminalprovider"
                                data={p}
                                size="sm"
                                showIcon
                            />
                        ))}
                    </div>
                )
            },
        },
        {
            accessorKey: "current_balance",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Saldo" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const balance = row.getValue("current_balance")
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Currency
                            value={balance as number}
                            currency={row.original.currency}
                            className="font-bold"
                        />
                    </div>
                )
            },
        },
        treasuryAccountActions.column(actionsCtx),
    ]

    return (
        <>
        <Tabs value={activeTab} className="h-full flex flex-col">
            <TabsContent value="accounts" className="space-y-6 flex-1 min-h-0">
                <div className="h-full flex flex-col">
                    <div className="flex-1 min-h-0">
                        <DataTableView
                            entityLabel="treasury.treasuryaccount"
                            columns={columns}
                            data={accounts}
                            isLoading={isLoading}
                            variant="embedded"
                            createAction={activeTab === "accounts" ? createAction : undefined}
                            smartSearch={<SmartSearchBar searchDef={treasuryAccountSearchDef} placeholder="Buscar cuenta..." className="w-full" />}
                            segmentation={<SegmentationBar def={treasuryAccountSegDef} />}
                            showReset={isFiltered}
                            onReset={() => { clearText(); clearSeg() }}
                            isFiltered={isFiltered}
                            emptyState={{
                                context: "treasury",
                                title: "Aún no hay cuentas de tesorería",
                                description: "Crea cuentas de caja o banco para registrar y controlar tus fondos.",
                            }}
                            renderCard={(acc: TreasuryAccount) => {
                                const name = acc.account_name
                                const providers = acc.terminal_providers ?? []
                                const hasBank = !!acc.bank
                                const hasProviders = providers.length > 0
                                const typeKey = acc.account_type?.toUpperCase()
                                const Icon = accountTypeIcons[typeKey]
                                const iconStyle = accountTypeIconStyles[typeKey]
                                return (
                                    <EntityCard key={acc.id} onClick={() => handleEdit(acc)} actions={treasuryAccountActions.render(acc, actionsCtx)}>
                                        <EntityCard.Header
                                            icon={Icon}
                                            iconClassName={iconStyle}
                                            title={acc.name}
                                            subtitle={
                                                <span className="flex items-center gap-1.5 flex-wrap">
                                                    <span>{acc.account_type_display || typeLabels[typeKey] || acc.account_type}</span>
                                                    {acc.bank_name && (
                                                        <>
                                                            <span className="text-muted-foreground/20">·</span>
                                                            <span>{acc.bank_name}</span>
                                                        </>
                                                    )}
                                                </span>
                                            }
                                            trailing={
                                                <DataCell.Currency value={acc.current_balance} currency={acc.currency} className="font-bold" />
                                            }
                                        />
                                        <EntityCard.Body>
                                            <EntityCard.Field label="Cuenta Contable" value={
                                                name ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <DataCell.Code className="text-[10px] bg-transparent p-0">{acc.account_code}</DataCell.Code>
                                                        <DataCell.Secondary className="truncate max-w-[140px] leading-tight">{name}</DataCell.Secondary>
                                                    </div>
                                                ) : <DataCell.Secondary className="italic">No vinculada</DataCell.Secondary>
                                            } />
                                            <EntityCard.Field label="Entidad Externa" value={
                                                !hasBank && !hasProviders ? (
                                                    <DataCell.Secondary className="italic">Sin entidad externa</DataCell.Secondary>
                                                ) : (
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {hasBank && acc.bank_name && (
                                                            <EntityBadge
                                                                label="treasury.bank"
                                                                data={{ id: acc.bank, name: acc.bank_name }}
                                                                size="sm"
                                                                showIcon
                                                            />
                                                        )}
                                                        {providers.map((p) => (
                                                            <EntityBadge
                                                                key={p.id}
                                                                label="treasury.terminalprovider"
                                                                data={p}
                                                                size="sm"
                                                                showIcon
                                                            />
                                                        ))}
                                                    </div>
                                                )
                                            } />
                                        </EntityCard.Body>
                                    </EntityCard>
                                )
                            }}
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="banks" className="flex-1 min-h-0">
                <FadeIn className="h-full">
                    <BankManagement
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

            <TabsContent value="methods" className="flex-1 min-h-0">
                <FadeIn className="h-full">
                    <PaymentMethodManagement
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
