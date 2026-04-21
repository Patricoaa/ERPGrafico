"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount } from "@/features/treasury"
import { Button } from "@/components/ui/button"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Landmark, Pencil, Trash2, Lock } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankManagement, PaymentMethodManagement } from "@/features/treasury"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface TreasuryAccountsViewProps {
    activeTab: string
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export const TreasuryAccountsView: React.FC<TreasuryAccountsViewProps> = ({ activeTab, externalOpen, createAction }) => {
    const { openTreasuryAccount } = useGlobalModalActions()
    const { accounts, deleteAccount, isLoading } = useTreasuryAccounts()
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
    const [isLocalAccountModalOpen, setIsLocalAccountModalOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

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

    const handleExternalAction = () => {
        switch (activeTab) {
            case "accounts":
                setIsLocalAccountModalOpen(true)
                handleAdd()
                break
            case "banks":
                setIsBankModalOpen(true)
                break
            case "methods":
                setIsMethodModalOpen(true)
                break
        }
    }

    useEffect(() => {
        if (externalOpen) {
            handleExternalAction()
        }
    }, [externalOpen])

    const handleDelete = async (id: number) => {
        try {
            await deleteAccount(id)
        } catch (error) {
            // Error already handled by hook
        }
    }

    const handleAdd = () => {
        openTreasuryAccount(null)
    }

    const handleEdit = (account: TreasuryAccount) => {
        openTreasuryAccount(account.id)
    }

    const columns: ColumnDef<TreasuryAccount>[] = [
        {
            accessorKey: "name",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Nombre | Tipo" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const acc = row.original
                const labels: Record<string, string> = {
                    'CHECKING': 'Cta. Corriente',
                    'CREDIT_CARD': 'T. Crédito',
                    'DEBIT_CARD': 'T. Débito',
                    'CHECKBOOK': 'Chequera',
                    'CASH': 'Efectivo',
                    'BRIDGE': 'Puente (Clearing)',
                    'MERCHANT': 'Recaudadora',
                }
                return (
                    <div className="flex flex-col items-center text-center w-full">
                        <DataCell.Text className="font-bold text-primary">{acc.name}</DataCell.Text>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                            <StatusBadge 
                                status={acc.account_type} 
                                label={labels[acc.account_type] || acc.account_type}
                                size="sm"
                                className="bg-muted/50 border-muted"
                            />
                            {acc.bank_name && (
                                <DataCell.Secondary className="text-[9px] flex items-center gap-0.5">
                                    <Landmark className="h-2.5 w-2.5" />
                                    {acc.bank_name}
                                </DataCell.Secondary>
                            )}
                        </div>
                    </div>
                )
            },
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
                    <div className="flex flex-col items-center justify-center w-full" title={`${row.original.account_code || ''} - ${name}`}>
                        <DataCell.Code>{row.original.account_code}</DataCell.Code>
                        <DataCell.Secondary className="truncate max-w-[180px]">{name}</DataCell.Secondary>
                    </div>
                )
            }
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
        {
            accessorKey: "account_type",
            header: "Tipo",
            enableHiding: true,
        },
        createActionsColumn<TreasuryAccount>({
            renderActions: (item) => (
                item.is_system_managed ? (
                    <DataCell.Action
                        icon={Lock}
                        title="Gestionada por sistema"
                        onClick={() => handleEdit(item)}
                        className="text-muted-foreground cursor-default opacity-50"
                    />
                ) : (
                    <>
                        <DataCell.Action icon={Pencil} title="Editar" onClick={() => handleEdit(item)} />
                        <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item.id)} />
                    </>
                )
            ),
        }),
    ]

    return (
        <Tabs value={activeTab} className="space-y-4">
            <TabsContent value="accounts" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <DataTable
                    columns={columns}
                    data={accounts}
                    cardMode
                    isLoading={isLoading}
                    searchPlaceholder="Buscar cuentas por nombre..."
                    filterColumn="name"
                    initialColumnVisibility={{
                        account_type: false
                    }}
                    facetedFilters={[
                        {
                            column: "account_type",
                            title: "Tipo de Cuenta",
                            options: [
                                { label: "Caja (Efectivo)", value: "CASH" },
                                { label: "Cta. Corriente", value: "CHECKING" },
                                { label: "T. Crédito", value: "CREDIT_CARD" },
                                { label: "T. Débito", value: "DEBIT_CARD" },
                                { label: "Chequera", value: "CHECKBOOK" },
                                { label: "Puente (Clearing)", value: "BRIDGE" },
                                { label: "Recaudadora", value: "MERCHANT" },
                            ]
                        }
                    ]}
                    useAdvancedFilter={true}
                    createAction={activeTab === "accounts" ? createAction : undefined}
                />
            </TabsContent>

            <TabsContent value="banks">
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
            </TabsContent>

            <TabsContent value="methods">
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
            </TabsContent>
        </Tabs>
    )
}

export default TreasuryAccountsView
