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
    DialogTrigger,
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
import { Plus, Pencil, Trash2, Loader2, Building2, Banknote, CheckCircle2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { AccountSelector } from "@/components/selectors/AccountSelector"

interface TreasuryAccount {
    id: number
    name: string
    code: string | null
    currency: string
    account: number | null
    account_name?: string
    account_details?: any
    account_type: 'BANK' | 'CASH'
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
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
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "account_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("account_type") as string
                return (
                    <div className="flex items-center gap-2">
                        {type === 'BANK' ? <Building2 className="h-4 w-4 text-blue-500" /> : <Banknote className="h-4 w-4 text-green-500" />}
                        {type === 'BANK' ? 'Banco' : 'Caja (Efectivo)'}
                    </div>
                )
            },
        },
        {
            accessorKey: "currency",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Moneda" />
            ),
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
                        {!acc.allows_cash && !acc.allows_card && !acc.allows_transfer && <span className="text-[10px] text-muted-foreground italic">Ninguno</span>}
                    </div>
                )
            },
        },
        {
            id: "accounting",
            header: "Cuenta Contable",
            cell: ({ row }) => {
                const acc = row.original
                return acc.account ? (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{acc.account_name || 'Cuenta Contable'}</span>
                        <span className="text-[10px] text-muted-foreground">ID: {acc.account}</span>
                    </div>
                ) : <span className="text-muted-foreground text-xs">Sin asignar</span>
            },
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Cuentas de Tesorería</h2>
                    <p className="text-muted-foreground">Administre sus cajas y cuentas bancarias.</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta
                </Button>
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
            } else {
                setName("")
                setType("CASH")
                setCurrency("CLP")
                setAccountingAccount(null)
                setAllowsCash(true) // Default for new account
                setAllowsCard(false)
                setAllowsTransfer(false)
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
                allows_transfer: allowsTransfer
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{account ? "Editar Cuenta" : "Nueva Cuenta de Tesorería"}</DialogTitle>
                    <DialogDescription>
                        Configure los detalles de la cuenta de caja o banco.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Nombre</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caja Principal, Banco Estado..." required />
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
                    <div className="grid gap-3 p-4 border rounded-lg bg-muted/20">
                        <Label className="text-sm font-bold">Métodos de Pago Permitidos</Label>
                        <div className="flex flex-wrap gap-6">
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
                        <p className="text-[10px] text-muted-foreground italic">
                            Seleccione todos los métodos que esta caja o banco puede recibir.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label>Cuenta Contable (Activo)</Label>
                        <AccountSelector
                            value={accountingAccount}
                            onChange={setAccountingAccount}
                            accountType="ASSET"
                            placeholder="Seleccione cuenta contable..."
                        />
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
