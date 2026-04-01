"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryApi } from "@/features/treasury"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Loader2, Landmark, CreditCard, List, MapPin, Shield, History } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { BankManagement, PaymentMethodManagement } from "@/features/treasury"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { LAYOUT_TOKENS, FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"


interface TreasuryAccountsViewProps {
    activeTab: string
}

export const TreasuryAccountsView: React.FC<TreasuryAccountsViewProps> = ({ activeTab }) => {
    const { openTreasuryAccount } = useGlobalModalActions()
    const { accounts, deleteAccount, refetch } = useTreasuryAccounts()
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)

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
                        amount={balance}
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
                    <div className="flex items-center gap-1.5 text-xs text-stone-600">
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
                    <div className="flex items-center gap-1 text-sm text-stone-600">
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

    const tabs = [
        { value: "accounts", label: "Cuentas de tesorería", iconName: "list", href: "/treasury/accounts?tab=accounts" },
        { value: "banks", label: "Bancos", iconName: "landmark", href: "/treasury/accounts?tab=banks" },
        { value: "methods", label: "Métodos", iconName: "credit-card", href: "/treasury/accounts?tab=methods" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "accounts":
                return {
                    title: "Cuentas de Tesorería",
                    description: "Registre y configure sus cuentas bancarias y de efectivo.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={handleAdd} title="Nueva Cuenta">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            case "banks":
                return {
                    title: "Gestión de Bancos",
                    description: "Administre las entidades bancarias globales del sistema.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsBankModalOpen(true)} title="Nuevo Banco">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            case "methods":
                return {
                    title: "Métodos de Pago",
                    description: "Configure los medios de pago aceptados y sus cuentas vinculadas.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsMethodModalOpen(true)} title="Nuevo Método">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            default:
                return { title: "Tesorería", description: "", actions: null }
        }
    }

    const { title, description, actions } = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <Tabs value={activeTab} className="space-y-4">
                <PageTabs tabs={tabs} activeValue={activeTab} />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={actions}
                />

                <TabsContent value="accounts" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <DataTable
                        columns={columns}
                        data={accounts}
                        cardMode
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
                    <BankManagement externalOpen={isBankModalOpen} onExternalOpenChange={setIsBankModalOpen} />
                </TabsContent>

                <TabsContent value="methods">
                    <PaymentMethodManagement externalOpen={isMethodModalOpen} onExternalOpenChange={setIsMethodModalOpen} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default TreasuryAccountsView

