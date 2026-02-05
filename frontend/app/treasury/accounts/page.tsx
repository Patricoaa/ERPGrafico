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
import { Plus, Pencil, Trash2, Loader2, Building2, Banknote, MapPin, Shield } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector" // Assuming this exists or creates generic selector

interface TreasuryAccount {
    id: number
    name: string
    code: string | null
    currency: string
    account: number | null
    account_name?: string
    account_type: 'BANK' | 'CASH'
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
    // New fields
    location: string
    custodian: number | null
    custodian_name?: string
    is_physical: boolean
    current_balance?: number
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
                    </div>
                )
            },
        },
        {
            accessorKey: "account_type",
            header: "Tipo",
            cell: ({ row }) => {
                const types = {
                    BANK: "Banco",
                    CASH: "Caja Efectivo"
                }
                return (
                    <div className="flex items-center gap-2">
                        {row.getValue("account_type") === 'BANK' ? <Building2 className="h-4 w-4 text-blue-500" /> : <Banknote className="h-4 w-4 text-green-500" />}
                        {types[row.getValue("account_type") as keyof typeof types] || row.getValue("account_type")}
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
            header: "Método de Pago",
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

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Cuentas de Tesorería</h2>
                <div className="flex items-center pt-1">
                    <Button size="icon" className="rounded-full h-8 w-8" onClick={openCreate} title="Nueva Cuenta">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="">
                <DataTable
                    columns={columns}
                    data={accounts}
                    filterColumn="name"
                    searchPlaceholder="Buscar por nombre..."
                    facetedFilters={[
                        {
                            column: "account_type",
                            title: "Tipo",
                            options: [
                                { label: "Bancos", value: "BANK" },
                                { label: "Caja", value: "CASH" },
                            ],
                        },
                    ]}
                />
            </div>

            <AccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                account={currentAccount}
                onSuccess={() => {
                    setDialogOpen(false)
                    fetchAccounts()
                }}
            />
        </div>
    )
}

function AccountDialog({ open, onOpenChange, account, onSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, account: TreasuryAccount | null, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [type, setType] = useState<"BANK" | "CASH">("CASH")
    const [currency, setCurrency] = useState("CLP")
    const [accountingAccount, setAccountingAccount] = useState<string | null>(null)
    const [allowsCash, setAllowsCash] = useState(false)
    const [allowsCard, setAllowsCard] = useState(false)
    const [allowsTransfer, setAllowsTransfer] = useState(false)

    // New fields
    const [location, setLocation] = useState("")
    const [custodian, setCustodian] = useState<string | null>(null)
    const [isPhysical, setIsPhysical] = useState(false)

    useEffect(() => {
        if (open) {
            if (account) {
                setName(account.name)
                setType(account.account_type)
                setCurrency(account.currency)
                setAccountingAccount(account.account ? account.account.toString() : null)
                setAllowsCash(account.allows_cash)
                setAllowsCard(account.allows_card)
                setAllowsTransfer(account.allows_transfer)
                // New fields
                setLocation(account.location || "")
                setCustodian(account.custodian ? account.custodian.toString() : null)
                setIsPhysical(account.is_physical || false)
            } else {
                setName("")
                setType("CASH")
                setCurrency("CLP")
                setAccountingAccount(null)
                setAllowsCash(true)
                setAllowsCard(false)
                setAllowsTransfer(false)
                setLocation("")
                setCustodian(null)
                setIsPhysical(false)
            }
        }
    }, [open, account])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
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
                is_physical: isPhysical
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
                        Configure los detalles de la cuenta.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Column 1: Basic Info */}
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Nombre</Label>
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
                                            <SelectItem value="CASH">Caja (Efectivo)</SelectItem>
                                            <SelectItem value="BANK">Banco</SelectItem>
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
                            <div className="grid gap-2">
                                <Label>Cuenta Contable (Activo)</Label>
                                <AccountSelector
                                    value={accountingAccount}
                                    onChange={setAccountingAccount}
                                    accountType="ASSET"
                                    isReconcilable={true}
                                    placeholder="Seleccione cuenta contable..."
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Cuenta donde se reflejará el saldo contable.
                                </p>
                            </div>
                        </div>

                        {/* Column 2: Physical & Config */}
                        <div className="space-y-4">
                            <div className="p-4 border rounded-lg bg-orange-50/50 space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="is-physical" checked={isPhysical} onCheckedChange={(v) => setIsPhysical(!!v)} />
                                    <Label htmlFor="is-physical" className="font-semibold cursor-pointer">¿Es un lugar físico?</Label>
                                </div>
                                {isPhysical && (
                                    <>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Ubicación</Label>
                                            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Oficina Central - Caja Fuerte" className="h-8 text-xs" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Responsable (Custodio)</Label>
                                            {/* Assuming UserSelector exists, otherwise basic select or input */}
                                            {/* Placeholder for user selector - using basic Input for now if UserSelector is not confirmed */}
                                            <Input value={custodian || ''} onChange={e => setCustodian(e.target.value || null)} placeholder="ID Usuario (Temporal)" className="h-8 text-xs" />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                                <Label className="text-sm font-bold">Métodos Permitidos</Label>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="check-cash" checked={allowsCash} onCheckedChange={(v) => setAllowsCash(!!v)} />
                                        <Label htmlFor="check-cash" className="text-xs cursor-pointer">Efectivo</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="check-card" checked={allowsCard} onCheckedChange={(v) => setAllowsCard(!!v)} />
                                        <Label htmlFor="check-card" className="text-xs cursor-pointer">Tarjeta</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="check-transfer" checked={allowsTransfer} onCheckedChange={(v) => setAllowsTransfer(!!v)} />
                                        <Label htmlFor="check-transfer" className="text-xs cursor-pointer">Transferencia</Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
