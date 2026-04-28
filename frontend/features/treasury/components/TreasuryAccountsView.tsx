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

    const handleAdd = () => {
        openTreasuryAccount(null)
    }

    const handleEdit = (account: TreasuryAccount) => {
        openTreasuryAccount(account.id)
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
            requestAnimationFrame(() => handleExternalAction());
        }
    }, [externalOpen]);

    const handleDelete = async (id: number) => {
        try {
            await deleteAccount(id)
        } catch (error) {
            // Error already handled by hook
        }
    }

    const typeLabels: Record<string, string> = {
        CASH: "Caja Física (Efectivo)",
        CHECKING: "Cuenta Bancaria",
        DEBIT_CARD: "T. Débito Empresa",
        CREDIT_CARD: "T. Crédito Empresa",
        CHECKBOOK: "Chequera / Instr.",
        BRIDGE: "Cta. Puente (Clearing)",
        MERCHANT: "Cta. Recaudadora",
    }

    const columns: ColumnDef<TreasuryAccount>[] = [
        {
            accessorKey: "name",
            header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Nombre de Cuenta" className="justify-center" />
            ),
            cell: ({ row }: { row: any }) => (
                <div className="flex flex-col items-center text-center w-full">
                    <DataCell.Text className="font-bold text-primary uppercase tracking-tight">
                        {row.original.name}
                    </DataCell.Text>
                    {row.original.bank_name && (
                        <DataCell.Secondary className="text-[10px] flex items-center gap-1 mt-0.5">
                            <Landmark className="h-3 w-3" />
                            {row.original.bank_name}
                        </DataCell.Secondary>
                    )}
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
                    <DataCell.Text className="text-muted-foreground font-medium text-xs">
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
            header: "Tipo (Filtro)",
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
                                { label: "Caja Física (Efectivo)", value: "CASH" },
                                { label: "Cuenta Bancaria", value: "CHECKING" },
                                { label: "T. Débito Empresa", value: "DEBIT_CARD" },
                                { label: "T. Crédito Empresa", value: "CREDIT_CARD" },
                                { label: "Chequera / Instr.", value: "CHECKBOOK" },
                                { label: "Cta. Puente (Clearing)", value: "BRIDGE" },
                                { label: "Cta. Recaudadora", value: "MERCHANT" },
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
