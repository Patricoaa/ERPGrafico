"use client"

import React, { useState, useEffect } from "react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ColumnDef
} from "@tanstack/react-table"
import { formatRUT } from "@/lib/utils/format"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
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
import { BankManagement, PaymentMethodManagement } from "@/components/treasury/MasterDataManagement"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"

interface TreasuryAccount {
    id: number
    name: string
    code: string | null
    currency: string
    account: number | null
    account_name?: string
    account_type: 'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH'
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    location: string
    custodian: number | null
    custodian_name?: string
    is_physical: boolean
    current_balance?: number
    bank?: number | null
    bank_name?: string
    account_number?: string | null
}

interface TreasuryAccountsViewProps {
    activeTab: string
}

export const TreasuryAccountsView: React.FC<TreasuryAccountsViewProps> = ({ activeTab }) => {
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
    const [isBankModalOpen, setIsBankModalOpen] = useState(false)
    const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)

    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [currentAccount, setCurrentAccount] = useState<TreasuryAccount | null>(null)

    const fetchAccounts = async () => {
        setLoading(true)
        try {
            const res = await api.get('/treasury/accounts/')
            setAccounts(res.data.results || res.data)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar cuentas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar esta cuenta?")) return
        try {
            await api.delete(`/treasury/accounts/${id}/`)
            toast.success("Cuenta eliminada")
            fetchAccounts()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    }

    const openCreate = () => {
        setCurrentAccount(null)
        setDialogOpen(true)
    }

    // Effect for external creation trigger
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre | Tipo" />
            ),
            cell: ({ row }) => {
                const acc = row.original
                const labels: Record<string, string> = {
                    'CHECKING': 'Cta. Corriente',
                    'CREDIT_CARD': 'T. Crédito',
                    'DEBIT_CARD': 'T. Débito',
                    'CHECKBOOK': 'Chequera',
                    'CASH': 'Efectivo',
                }
                return (
                    <div className="flex flex-col">
                        <span className="font-bold text-primary">{acc.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuenta Contable" />
            ),
            cell: ({ row }) => {
                const name = row.original.account_name
                if (!name) return <span className="text-muted-foreground italic text-xs">No vinculada</span>
                return (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{row.original.account || ''}</span>
                    </div>
                )
            }
        },
        {
            accessorKey: "current_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" />
            ),
            cell: ({ row }) => {
                const balance = parseFloat(row.getValue("current_balance") || "0")
                return (
                    <div className={`font-bold ${balance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {new Intl.NumberFormat("es-CL", {
                            style: "currency",
                            currency: row.original.currency
                        }).format(balance)}
                    </div>
                )
            },
        },
        {
            accessorKey: "location",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Ubicación" />
            ),
            cell: ({ row }) => {
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
            cell: ({ row }) => {
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
            cell: ({ row }) => {
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
        { value: "accounts", label: "Cuentas de tesorería", icon: List, href: "/treasury/accounts?tab=accounts" },
        { value: "banks", label: "Bancos", icon: Landmark, href: "/treasury/accounts?tab=banks" },
        { value: "methods", label: "Métodos", icon: CreditCard, href: "/treasury/accounts?tab=methods" },
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
        <div className="flex-1 space-y-4 p-8 pt-6">
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
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setIsAccountModalOpen(false)
                }}
                account={currentAccount}
                onSuccess={() => {
                    setDialogOpen(false)
                    setIsAccountModalOpen(false)
                    fetchAccounts()
                }}
            />
        </div>
    )
}

function AccountDialog({ open, onOpenChange, account, onSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, account: TreasuryAccount | null, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [type, setType] = useState<'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH'>("CASH")
    const [currency, setCurrency] = useState("CLP")
    const [accountingAccount, setAccountingAccount] = useState<string | null>(null)
    const [location, setLocation] = useState("")
    const [custodian, setCustodian] = useState<number | null>(null)
    const [isPhysical, setIsPhysical] = useState(false)
    const [bank, setBank] = useState<string | null>(null)
    const [accountNumber, setAccountNumber] = useState("")
    const [banks, setBanks] = useState<any[]>([])

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await api.get('/treasury/banks/')
                setBanks(res.data)
            } catch (err) { }
        }
        if (open) fetchBanks()
    }, [open])

    useEffect(() => {
        if (open) {
            if (account) {
                setName(account.name)
                setType(account.account_type)
                setCurrency(account.currency)
                setAccountingAccount(account.account ? account.account.toString() : null)
                setLocation(account.location || "")
                setCustodian(account.custodian || null)
                setIsPhysical(account.is_physical || false)
                setBank(account.bank ? account.bank.toString() : null)
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
        }
    }, [open, account])

    const requiresBank = (accountType: string) => {
        return ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(accountType)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
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
                await api.patch(`/treasury/accounts/${account.id}/`, payload)
                toast.success("Cuenta actualizada")
            } else {
                await api.post('/treasury/accounts/', payload)
                toast.success("Cuenta creada")
            }
            onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error al guardar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1100px] h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{account ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle>
                    <DialogDescription>
                        {account ? "Modifique los detalles de la cuenta y revise su historial." : "Complete la información para registrar una nueva cuenta."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
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
                                            <Label className="text-blue-600 font-semibold flex items-center gap-1">
                                                <Landmark className="h-3.5 w-3.5" /> Entidad Bancaria
                                            </Label>
                                            <Select value={bank || ""} onValueChange={setBank}>
                                                <SelectTrigger className="border-blue-200 bg-blue-50/30">
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
                                            <Label className="text-blue-600 font-semibold flex items-center gap-1">
                                                <CreditCard className="h-3.5 w-3.5" /> N° de Cuenta Bancaria
                                            </Label>
                                            <Input
                                                value={accountNumber}
                                                onChange={e => setAccountNumber(e.target.value)}
                                                placeholder="Ej: 0123456789"
                                                className="border-blue-200 bg-blue-50/30"
                                            />
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label>Cuenta Contable</Label>
                                        <AccountSelector
                                            value={accountingAccount}
                                            onChange={setAccountingAccount}
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
                                    <div className="p-4 border rounded-xl bg-orange-50/30 space-y-3 border-orange-100">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="is-physical" checked={isPhysical} onCheckedChange={(v) => setIsPhysical(!!v)} />
                                            <Label htmlFor="is-physical" className="font-semibold cursor-pointer">¿Es un lugar físico?</Label>
                                        </div>
                                        {isPhysical && (
                                            <div className="space-y-3 pt-2 border-t border-orange-100 animate-in fade-in duration-300">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[11px] uppercase tracking-wider text-orange-600 font-bold">Ubicación</Label>
                                                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Oficina Central" className="h-8 text-xs bg-white" />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[11px] uppercase tracking-wider text-orange-600 font-bold">Custodio</Label>
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

                <DialogFooter className="p-6 pt-4 border-t bg-white z-10">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="account-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {account ? "Guardar Cambios" : "Crear Cuenta"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default TreasuryAccountsView
