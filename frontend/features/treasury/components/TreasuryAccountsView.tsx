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
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

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
                <DataTableColumnHeader column={column} title="Nombre | Tipo" />
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
                    <div className="flex flex-col items-center text-center">
                        <span className="font-bold text-primary">{acc.name}</span>
                        <div className="flex items-center justify-center gap-1.5 mt-0.5">
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 uppercase bg-muted/50">
                                {labels[acc.account_type] || acc.account_type}
                            </Badge>
                            {acc.bank_name && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                    <Landmark className="h-2.5 w-2.5" />
                                    {acc.bank_name}
                                </span>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "account_name",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Cuenta Contable" />
            ),
            cell: ({ row }: { row: any }) => {
                const name = row.original.account_name
                if (!name) return <span className="text-muted-foreground italic text-xs">No vinculada</span>
                return (
                    <div className="flex justify-center w-full" title={`${row.original.account_code || ''} - ${name}`}>
                        <div className="text-center text-xs truncate max-w-[200px] flex items-center justify-center gap-1">
                            <span className="font-mono font-bold whitespace-nowrap">{row.original.account_code}</span>
                            <span className="text-muted-foreground font-medium truncate">{name}</span>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "current_balance",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Saldo" />
            ),
            cell: ({ row }: { row: any }) => {
                const balance = row.getValue("current_balance")
                return (
                    <MoneyDisplay
                        amount={balance as number}
                        currency={row.original.currency}
                    />
                )
            },
        },
        {
            accessorKey: "location",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Ubicación" />
            ),
            cell: ({ row }: { row: any }) => {
                const val = row.original.location
                if (!val) return <span className="text-muted-foreground">-</span>
                return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 text-warning" />
                        {val}
                    </div>
                )
            }
        },
        {
            id: "custodian",
            header: "Responsable",
            cell: ({ row }: { row: any }) => {
                const acc = row.original
                if (!acc.custodian_name) return <span className="text-muted-foreground">-</span>
                return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3 text-info" />
                        {acc.custodian_name}
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
            cell: ({ row }: { row: any }) => {
                const acc = row.original
                return (
                    <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(acc)} title="Editar">
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(acc.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
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
