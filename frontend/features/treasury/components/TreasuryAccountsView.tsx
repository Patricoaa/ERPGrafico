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
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { LAYOUT_TOKENS } from "@/lib/styles"



interface TreasuryAccountsViewProps {
    activeTab: string
}

export const TreasuryAccountsView: React.FC<TreasuryAccountsViewProps> = ({ activeTab }) => {
    const { accounts, deleteAccount, refetch, createAccount, updateAccount, isCreating, isUpdating } = useTreasuryAccounts()
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [currentAccount, setCurrentAccount] = useState<TreasuryAccount | null>(null)

    const handleDelete = async (id: number) => {
        try {
            await deleteAccount(id)
        } catch (error) {
            // Error already handled by hook
        }
    }

    const openCreate = () => {
        setCurrentAccount(null)
        setDialogOpen(true)
        setIsAccountModalOpen(false) // Reset external trigger
    }

    // Reset external creation trigger state when modal opens
    useEffect(() => {
        if (isAccountModalOpen) {
            openCreate()
        }
    }, [isAccountModalOpen])

    const openEdit = (account: TreasuryAccount) => {
        setCurrentAccount(account)
        setDialogOpen(true)
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
                        <MapPin className="h-3 w-3 text-orange-500" />
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
                        <Shield className="h-3 w-3 text-blue-500" />
                        {acc.custodian_name}
                    </div>
                )
            }
        },
        {
            id: "actions",
            cell: ({ row }: { row: any }) => {
                const acc = row.original
                return (
                    <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(acc)} title="Editar">
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
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsAccountModalOpen(true)} title="Nueva Cuenta">
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
                <ServerPageTabs tabs={tabs} activeValue={activeTab} />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={actions}
                />

                <TabsContent value="accounts" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <DataTable
                        columns={columns}
                        data={accounts}
                        searchPlaceholder="Buscar cuentas por nombre..."
                        filterColumn="name"
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

            <AccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                account={currentAccount}
                onSuccess={() => {
                    refetch()
                    setDialogOpen(false)
                }}
                createAccount={createAccount}
                updateAccount={updateAccount}
                isSubmitting={isCreating || isUpdating}
            />
        </div>
    )
}

interface AccountDialogProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    account: TreasuryAccount | null
    onSuccess: () => void
    createAccount: (payload: Partial<TreasuryAccount>) => Promise<TreasuryAccount>
    updateAccount: (params: { id: number, payload: Partial<TreasuryAccount> }) => Promise<TreasuryAccount>
    isSubmitting: boolean
}

function AccountDialog({ open, onOpenChange, account, onSuccess, createAccount, updateAccount, isSubmitting }: AccountDialogProps) {
    const [name, setName] = useState("")
    const [type, setType] = useState<'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH'>("CASH")
    const [currency, setCurrency] = useState("CLP")
    const [accountingAccount, setAccountingAccount] = useState<number | null>(null)
    const [location, setLocation] = useState("")
    const [custodian, setCustodian] = useState<number | null>(null)
    const [isPhysical, setIsPhysical] = useState(false)
    const [bank, setBank] = useState<number | null>(null)
    const [accountNumber, setAccountNumber] = useState("")
    const [banks, setBanks] = useState<any[]>([])

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const data = await treasuryApi.getBanks()
                setBanks(data)
            } catch (err) { }
        }
        if (open) fetchBanks()
    }, [open])

    useEffect(() => {
        if (!open) return

        if (account) {
            setName(account.name)
            setType(account.account_type)
            setCurrency(account.currency)
            setAccountingAccount(account.account ? Number(account.account) : null)
            setLocation(account.location || "")
            setCustodian(account.custodian || null)
            setIsPhysical(account.is_physical || false)
            setBank(account.bank ? Number(account.bank) : null)
            setAccountNumber(account.account_number || "")
        } else {
            setName("")
            setType("CASH")
            setCurrency("CLP")
            setAccountingAccount(null)
            setLocation("")
            setCustodian(null)
            setIsPhysical(false)
            setBank(null)
            setAccountNumber("")
        }
    }, [open, account])

    const requiresBank = (accountType: string) => {
        return ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(accountType)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const allowsCash = type === 'CASH'
            const allowsCard = ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(type)
            const allowsTransfer = ['CHECKING'].includes(type)

            const payload = {
                name,
                account_type: type,
                currency,
                account: accountingAccount,
                allows_cash: allowsCash,
                allows_card: allowsCard,
                allows_transfer: allowsTransfer,
                location,
                custodian,
                is_physical: isPhysical,
                bank: requiresBank(type) ? bank : null,
                account_number: requiresBank(type) ? accountNumber : null
            }
            if (account) {
                await updateAccount({ id: account.id, payload })
            } else {
                await createAccount(payload)
            }
            onSuccess()
        } catch (error: any) {
            // Error handled by hook
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={account ? "Editar Cuenta" : "Nueva Cuenta"}
            description={account ? "Modifique los detalles de la cuenta y revise su historial." : "Complete la información para registrar una nueva cuenta."}
            hideScrollArea={true}
            className="h-[85vh]"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="account-form" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {account ? "Guardar Cambios" : "Crear Cuenta"}
                    </Button>
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden h-full">
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                    <form id="account-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Nombre de la Cuenta</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caja Principal" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Tipo</Label>
                                        <Select value={type} onValueChange={(v: any) => setType(v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CHECKING">Cuenta Corriente</SelectItem>
                                                <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                                                <SelectItem value="DEBIT_CARD">Tarjeta de Débito</SelectItem>
                                                <SelectItem value="CHECKBOOK">Chequera</SelectItem>
                                                <SelectItem value="CASH">Efectivo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Moneda</Label>
                                        <Select value={currency} onValueChange={setCurrency}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CLP">Pesos (CLP)</SelectItem>
                                                <SelectItem value="USD">Dólar (USD)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {requiresBank(type) && (
                                    <div className="grid gap-2 animate-in slide-in-from-left-2 duration-300">
                                        <Label className="text-info font-semibold flex items-center gap-1">
                                            <Landmark className="h-3.5 w-3.5" /> Entidad Bancaria
                                        </Label>
                                        <Select value={bank?.toString() || ""} onValueChange={(v) => setBank(v ? Number(v) : null)}>
                                            <SelectTrigger className="border-info/20 bg-info/5">
                                                <SelectValue placeholder="Seleccione banco..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {banks.map((b: any) => (
                                                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {requiresBank(type) && (
                                    <div className="grid gap-2 animate-in slide-in-from-left-2 duration-300">
                                        <Label className="text-info font-semibold flex items-center gap-1">
                                            <CreditCard className="h-3.5 w-3.5" /> N° de Cuenta Bancaria
                                        </Label>
                                        <Input
                                            value={accountNumber}
                                            onChange={e => setAccountNumber(e.target.value)}
                                            placeholder="Ej: 0123456789"
                                            className="border-info/20 bg-info/5"
                                        />
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label>Cuenta Contable</Label>
                                    <AccountSelector
                                        value={accountingAccount?.toString() || null}
                                        onChange={(v) => setAccountingAccount(v ? Number(v) : null)}
                                        accountType="ASSET"
                                        isReconcilable={true}
                                        placeholder="Seleccione cuenta..."
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Vínculo con el plan de cuentas.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 border rounded-xl bg-warning/5 space-y-3 border-warning/10">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="is-physical" checked={isPhysical} onCheckedChange={(v) => setIsPhysical(!!v)} />
                                        <Label htmlFor="is-physical" className="font-semibold cursor-pointer">¿Es un lugar físico?</Label>
                                    </div>
                                    {isPhysical && (
                                        <div className="space-y-3 pt-2 border-t border-warning/10 animate-in fade-in duration-300">
                                            <div className="grid gap-1.5">
                                                <Label className="text-[11px] uppercase tracking-wider text-warning font-bold">Ubicación</Label>
                                                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Oficina Central" className="h-8 text-xs bg-white" />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label className="text-[11px] uppercase tracking-wider text-warning font-bold">Custodio</Label>
                                                <UserSelector value={custodian} onChange={setCustodian} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </form>
                </div>

                <div className="w-[350px] flex flex-col bg-muted/10 border-l overflow-hidden">
                    {account ? (
                        <ActivitySidebar
                            entityType="treasuryaccount"
                            entityId={account.id}
                            className="h-full border-none"
                            title="Historial de Cambios"
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <History className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm">El historial estará disponible una vez creada la cuenta.</p>
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    )
}

export default TreasuryAccountsView
