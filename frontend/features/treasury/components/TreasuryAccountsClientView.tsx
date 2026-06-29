"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryAccountActions, type TreasuryAccountActionsCtx } from "@/features/treasury"
import { EntityCard, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from '@/components/shared'
import { treasuryAccountSearchDef } from "../searchDef"
import { treasuryAccountSegDef } from "../segmentationDef"
import {
    type ColumnDef,
    type Row,
} from "@tanstack/react-table"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankCenterClientView, PaymentMethodClientView } from "@/features/treasury"
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
        ISSUED_CHECKS: "Cheques Girados por Pagar",
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

    const columns: ColumnDef<TreasuryAccount>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre de Cuenta" className="justify-center" />
            ),
            cell: ({ row }: { row: Row<TreasuryAccount> }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>
                        {row.original.name}
                    </DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "account_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipología" className="justify-center" />
            ),
            cell: ({ row }: { row: Row<TreasuryAccount> }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>
                        {row.original.account_type_display || typeLabels[row.original.account_type] || row.original.account_type}
                    </DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "account_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuenta Contable" className="justify-center" />
            ),
            cell: ({ row }: { row: Row<TreasuryAccount> }) => {
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Entidad Externa" className="justify-center" />
            ),
            cell: ({ row }: { row: Row<TreasuryAccount> }) => {
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" className="justify-center" />
            ),
            cell: ({ row }: { row: Row<TreasuryAccount> }) => {
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
        <Tabs value={activeTab} className="flex-1 min-h-0 flex flex-col">
            <TabsContent value="accounts" className="space-y-6 flex-1 min-h-0">
                <div className="flex-1 min-h-0 flex flex-col">
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
                                const typeKey = acc.account_type?.toUpperCase()
                                const Icon = accountTypeIcons[typeKey]
                                const iconStyle = accountTypeIconStyles[typeKey]
                                return (
                                    <EntityCard key={acc.id} onClick={() => handleEdit(acc)}>
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
                                            center={
                                                <div className="flex items-start gap-6 text-xs">
                                                    <div className="flex flex-col gap-0.5 items-center">
                                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Cta. Contable</span>
                                                        {name ? (
                                                            <span className="flex items-center gap-1.5 font-medium text-foreground/80 whitespace-nowrap">
                                                                <DataCell.Code className="text-xs bg-transparent p-0">{acc.account_code}</DataCell.Code>
                                                                <span className="text-muted-foreground/20">·</span>
                                                                <span className="font-medium text-foreground/80">{name}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40 italic">No vinculada</span>
                                                        )}
                                                    </div>
                                                </div>
                                            }
                                            trailing={
                                                <div className="flex flex-col gap-0.5 items-end">
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Saldo</span>
                                                    <DataCell.Currency value={acc.current_balance} currency={acc.currency} className="font-bold" />
                                                </div>
                                            }
                                        />
                                        <EntityCard.Body actions={treasuryAccountActions.render(acc, actionsCtx)}>
                                            {hasBank && (
                                                <EntityCard.Field
                                                    label="Entidad Externa"
                                                    icon={Landmark}
                                                    value={
                                                        <span className="flex items-center gap-1 text-foreground/80 font-medium">
                                                            {acc.bank_name}
                                                        </span>
                                                    }
                                                />
                                            )}
                                        </EntityCard.Body>
                                    </EntityCard>
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
