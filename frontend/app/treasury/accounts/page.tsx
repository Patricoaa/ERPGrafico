"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
import { Plus, Pencil, Trash2, Loader2, Building2, Banknote } from "lucide-react"
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

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Moneda</TableHead>
                            <TableHead>Cuenta Contable Asociada</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : accounts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No hay cuentas registradas.
                                </TableCell>
                            </TableRow>
                        ) : (
                            accounts.map((acc) => (
                                <TableRow key={acc.id}>
                                    <TableCell className="font-medium">{acc.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {acc.account_type === 'BANK' ? <Building2 className="h-4 w-4 text-blue-500" /> : <Banknote className="h-4 w-4 text-green-500" />}
                                            {acc.account_type === 'BANK' ? 'Banco' : 'Caja (Efectivo)'}
                                        </div>
                                    </TableCell>
                                    <TableCell>{acc.currency}</TableCell>
                                    <TableCell>
                                        {acc.account ? (
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{acc.account_name || 'Cuenta Contable'}</span>
                                                <span className="text-[10px] text-muted-foreground">ID: {acc.account}</span>
                                            </div>
                                        ) : <span className="text-muted-foreground text-xs">Sin asignar</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(acc.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
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

    useEffect(() => {
        if (open) {
            if (account) {
                setName(account.name)
                setType(account.account_type)
                setCurrency(account.currency)
                setAccountingAccount(account.account ? account.account.toString() : null)
            } else {
                setName("")
                setType("CASH")
                setCurrency("CLP")
                setAccountingAccount(null)
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
                account: accountingAccount
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
            <DialogContent>
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
                    <div className="grid gap-2">
                        <Label>Cuenta Contable (Activo)</Label>
                        <AccountSelector
                            value={accountingAccount}
                            onChange={setAccountingAccount}
                            accountType="ASSET"
                            placeholder="Seleccione cuenta contable..."
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Los movimientos de esta cuenta se reflejarán en la cuenta contable seleccionada.
                        </p>
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
