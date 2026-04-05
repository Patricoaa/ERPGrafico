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
import { Landmark, Pencil, Trash2, MapPin, Shield } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankManagement, PaymentMethodManagement } from "@/features/treasury"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { DataCell } from "@/components/ui/data-table-cells"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface TreasuryAccountsViewProps {
    activeTab: string
    externalOpen?: boolean
}

export const TreasuryAccountsView: React.FC<TreasuryAccountsViewProps> = ({ activeTab, externalOpen }) => {
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
            accessorKey: "location",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Ubicación" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const val = row.original.location
                if (!val) return <div className="flex justify-center text-muted-foreground opacity-30">-</div>
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Secondary className="text-center flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-warning" />
                            {val}
                        </DataCell.Secondary>
                    </div>
                )
            }
        },
        {
            id: "custodian",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Responsable" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const acc = row.original
                if (!acc.custodian_name) return <div className="flex justify-center text-muted-foreground opacity-30">-</div>
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Secondary className="text-center flex items-center gap-1.5">
                            <Shield className="h-3 w-3 text-info" />
                            {acc.custodian_name}
                        </DataCell.Secondary>
                    </div>
                )
            }
        },
        {
            accessorKey: "account_type",
            header: "Tipo",
            enableHiding: true,
        },
        {
            id: "actions",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Acciones" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => {
                const acc = row.original
                return (
                    <div className="flex items-center justify-center gap-1.5 w-full">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(acc)} 
                            className="h-8 w-8 rounded-[0.25rem] hover:bg-primary/10 hover:text-primary transition-colors"
                            title="Editar"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-[0.25rem] hover:bg-rose-500/10 hover:text-rose-600 text-muted-foreground/50 transition-colors"
                            onClick={() => handleDelete(acc.id)} 
                            title="Eliminar"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )
            },
        },
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
                            ]
                        }
                    ]}
                    useAdvancedFilter={true}
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
                />
            </TabsContent>
        </Tabs>
    )
}

export default TreasuryAccountsView
