"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ColumnDef
} from "@tanstack/react-table"
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
import { Plus, Pencil, Trash2, Loader2, Building2, Banknote, MapPin, Shield, Landmark, CreditCard, List } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BankManagement, PaymentMethodManagement } from "@/components/treasury/MasterDataManagement"
import { TerminalManagement } from "@/components/treasury/TerminalManagement"

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

export default function TreasuryAccountsPage() {
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

    const openEdit = (account: TreasuryAccount) => {
        setCurrentAccount(account)
        setDialogOpen(true)
    }

    const columns: ColumnDef<TreasuryAccount>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => {
                const acc = row.original
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{acc.name}</span>
                        {acc.is_physical && (
                            <Badge variant="outline" className="w-fit text-[10px] mt-1 border-stone-400 text-stone-600">
                                <MapPin className="h-3 w-3 mr-1" />
                                {acc.location || 'Físico sin ubicación'}
                            </Badge>
                        )}
                        {acc.bank_name && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-600 mt-1">
                                <Landmark className="h-3 w-3" />
                                {acc.bank_name}
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "account_type",
            header: "Tipo",
            cell: ({ row }) => {
                const type = row.getValue("account_type") as string
                const labels: Record<string, string> = {
                    'CHECKING': 'Cuenta Corriente',
                    'CREDIT_CARD': 'Tarjeta de Crédito',
                    'DEBIT_CARD': 'Tarjeta de Débito',
                    'CHECKBOOK': 'Chequera',
                    'CASH': 'Efectivo',
                    'BANK': 'Banco' // Legacy support just in case
                }

                const getIcon = (t: string) => {
                    switch (t) {
                        case 'CHECKING': return <Landmark className="h-4 w-4 text-blue-500" />
                        case 'CREDIT_CARD': return <CreditCard className="h-4 w-4 text-purple-500" />
                        case 'DEBIT_CARD': return <CreditCard className="h-4 w-4 text-green-500" />
                        case 'CHECKBOOK': return <List className="h-4 w-4 text-orange-500" />
                        case 'CASH': return <Banknote className="h-4 w-4 text-emerald-500" />
                        default: return <Building2 className="h-4 w-4 text-muted-foreground" />
                    }
                }

                return (
                    <div className="flex items-center gap-2">
                        {getIcon(type)}
                        <span>{labels[type] || type}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "current_balance",
            header: ({ column }) => (
                <div className="text-right">Saldo</div>
            ),
            cell: ({ row }) => {
                const balance = parseFloat(row.getValue("current_balance") || "0")
                return (
                    <div className={`text-right font-medium ${balance < 0 ? "text-red-500" : ""}`}>
                        {new Intl.NumberFormat("es-CL", {
                            style: "currency",
                            currency: row.original.currency
                        }).format(balance)}
                    </div>
                )
            },
        },
        {
            id: "methods",
            header: "Métodos Permitidos",
            cell: ({ row }) => {
                const acc = row.original
                return (
                    <div className="flex flex-wrap gap-1">
                        {acc.allows_cash && <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 border-emerald-200 bg-emerald-50">Efectivo</Badge>}
                        {acc.allows_card && <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-600 border-blue-200 bg-blue-50">Tarjeta</Badge>}
                        {acc.allows_transfer && <Badge variant="outline" className="text-[10px] uppercase font-bold text-purple-600 border-purple-200 bg-purple-50">Transf.</Badge>}
                    </div>
                )
            },
        },
        {
            id: "custodian",
            header: "Responsable",
            cell: ({ row }) => {
                const acc = row.original
                if (!acc.custodian_name) return <span className="text-muted-foreground">-</span>
                return (
                    <div className="flex items-center gap-1 text-sm text-stone-600">
                        <Shield className="h-3 w-3" />
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

        < div className = "flex-1 space-y-4 p-8 pt-6" >
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Tesorería</h2>
                    <p className="text-muted-foreground">Administración de cuentas, bancos y métodos de pago.</p>
                </div>
            </div>

            <Tabs defaultValue="accounts" className="space-y-4">
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-muted/50 rounded-full h-12 p-1 border">
                        <TabsTrigger value="accounts" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <List className="h-4 w-4" /> 
                            <span className="max-sm:hidden">Cuentas</span>
                        </TabsTrigger>
                        <TabsTrigger value="banks" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Landmark className="h-4 w-4" />
                            <span className="max-sm:hidden">Bancos</span>
                        </TabsTrigger>
                        <TabsTrigger value="methods" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span className="max-sm:hidden">Métodos</span>
                        </TabsTrigger>
                        <TabsTrigger value="terminals" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Banknote className="h-4 w-4" />
                            <span className="max-sm:hidden">Terminales</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="accounts" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex justify-between items-center bg-white/50 p-5 rounded-xl border border-primary/10 backdrop-blur-md shadow-sm">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-primary">Cuentas y Cajas</h2>
                            <p className="text-sm text-muted-foreground">Registre y configure sus cuentas bancarias y cajas físicas.</p>
                        </div>
                        <Button onClick={openCreate} size="lg" className="rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                            <Plus className="mr-2 h-5 w-5" /> Nueva Cuenta
                        </Button>
                    </div>

                    <DataTable
                        columns={columns}
                        data={accounts}
                        searchPlaceholder="Buscar cuentas..."
                        filterColumn="name"
                    />
                </TabsContent>

                <TabsContent value="banks">
                    <BankManagement />
                </TabsContent>

                <TabsContent value="methods">
                    <PaymentMethodManagement />
                </TabsContent>

                <TabsContent value="terminals">
                    <TerminalManagement />
                </TabsContent>
            </Tabs>

            <AccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                account={currentAccount}
                onSuccess={() => {
                    setDialogOpen(false)
                    fetchAccounts()
                }}
            />
        </div >
    )
}

function AccountDialog({ open, onOpenChange, account, onSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, account: TreasuryAccount | null, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [type, setType] = useState<'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH'>("CASH")
    const [currency, setCurrency] = useState("CLP")
    const [accountingAccount, setAccountingAccount] = useState<string | null>(null)
    // Removed manual flags state
    // const [allowsCash, setAllowsCash] = useState(false)
    // ...

    // Detailed fields
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
                // setAllowsCash(true)
                // setAllowsCard(false)
                // setAllowsTransfer(false)
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
                // Flags auto-set on submit
                setLocation("")
                setCustodian(null)
                setIsPhysical(false)
                setBank(null)
                setAccountNumber("")
            }
        }
    }, [open, account])

    // Helper function to determine if account type requires bank
    const requiresBank = (accountType: string) => {
        return ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(accountType)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Auto-calculate capabilities based on type
            const allowsCash = type === 'CASH'
            // Checking, Debit, Credit card accounts allow cards methods (usually)
            const allowsCard = ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(type)
            // Checking allows transfers
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
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>{account ? "Editar Cuenta" : "Nueva Cuenta de Tesorería"}</DialogTitle>
                    <DialogDescription>
                        Configure los detalles de la cuenta de tesorería.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Column 1: Basic Info */}
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

                        {/* Column 2: Physical & Config */}
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

                    <DialogFooter className="pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading} className="px-8">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {account ? "Actualizar Cuenta" : "Crear Cuenta"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    )
}
