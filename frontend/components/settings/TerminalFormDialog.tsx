"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface Terminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number
    allowed_payment_methods: string[]
    serial_number: string
    ip_address: string | null
}

interface TreasuryAccount {
    id: number
    name: string
    code: string
    account_type: string
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
}

interface TerminalFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    terminal: Terminal | null
    onSuccess: () => void
}

export function TerminalFormDialog({ open, onOpenChange, terminal, onSuccess }: TerminalFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])

    // Form state
    const [name, setName] = useState("")
    const [code, setCode] = useState("")
    const [location, setLocation] = useState("")
    const [serialNumber, setSerialNumber] = useState("")
    const [ipAddress, setIpAddress] = useState("")
    const [defaultTreasuryAccount, setDefaultTreasuryAccount] = useState<string>("")
    const [paymentMethods, setPaymentMethods] = useState<{ cash: boolean, card: boolean, transfer: boolean }>({
        cash: true,
        card: false,
        transfer: false
    })

    useEffect(() => {
        if (open) {
            fetchTreasuryAccounts()

            if (terminal) {
                // Edit mode - populate form
                setName(terminal.name)
                setCode(terminal.code)
                setLocation(terminal.location || "")
                setSerialNumber(terminal.serial_number || "")
                setIpAddress(terminal.ip_address || "")
                setDefaultTreasuryAccount(terminal.default_treasury_account.toString())
                setPaymentMethods({
                    cash: terminal.allowed_payment_methods.includes('CASH'),
                    card: terminal.allowed_payment_methods.includes('CARD'),
                    transfer: terminal.allowed_payment_methods.includes('TRANSFER')
                })
            } else {
                // Create mode - reset form
                setName("")
                setCode("")
                setLocation("")
                setSerialNumber("")
                setIpAddress("")
                setDefaultTreasuryAccount("")
                setPaymentMethods({ cash: true, card: false, transfer: false })
            }
        }
    }, [open, terminal])

    const fetchTreasuryAccounts = async () => {
        try {
            const res = await api.get('/treasury/accounts/')
            setTreasuryAccounts(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching treasury accounts", error)
            toast.error("Error al cargar cuentas de tesorería")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!name || !code || !defaultTreasuryAccount) {
            toast.error("Complete los campos obligatorios")
            return
        }

        // Build allowed_payment_methods array
        const allowedMethods: string[] = []
        if (paymentMethods.cash) allowedMethods.push('CASH')
        if (paymentMethods.card) allowedMethods.push('CARD')
        if (paymentMethods.transfer) allowedMethods.push('TRANSFER')

        if (allowedMethods.length === 0) {
            toast.error("Seleccione al menos un método de pago")
            return
        }

        const payload = {
            name,
            code,
            location,
            serial_number: serialNumber,
            ip_address: ipAddress || null,
            default_treasury_account: parseInt(defaultTreasuryAccount),
            allowed_payment_methods: allowedMethods,
            is_active: true
        }

        try {
            setLoading(true)

            if (terminal) {
                // Update existing terminal
                await api.patch(`/treasury/pos-terminals/${terminal.id}/`, payload)
                toast.success("Terminal actualizado correctamente")
            } else {
                // Create new terminal
                await api.post('/treasury/pos-terminals/', payload)
                toast.success("Terminal creado correctamente")
            }

            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving terminal", error)

            // Handle validation errors
            if (error.response?.data) {
                const errors = error.response.data
                if (errors.code) {
                    toast.error(`Código: ${errors.code[0]}`)
                } else if (errors.default_treasury_account) {
                    toast.error(`${errors.default_treasury_account}`)
                } else if (errors.allowed_payment_methods) {
                    toast.error(`${errors.allowed_payment_methods}`)
                } else {
                    toast.error("Error al guardar terminal")
                }
            } else {
                toast.error("Error al guardar terminal")
            }
        } finally {
            setLoading(false)
        }
    }

    // Filter treasury accounts compatible with selected payment methods
    const compatibleAccounts = treasuryAccounts.filter(account => {
        if (paymentMethods.cash && !account.allows_cash) return false
        if (paymentMethods.card && !account.allows_card) return false
        if (paymentMethods.transfer && !account.allows_transfer) return false
        return true
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{terminal ? "Editar Terminal" : "Nuevo Terminal"}</DialogTitle>
                    <DialogDescription>
                        Configure un terminal de punto de venta y sus métodos de pago permitidos
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Nombre <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="Ej: Caja 1, Mostrador Principal"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="code">
                                Código <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="code"
                                placeholder="Ej: TERM-01"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">Ubicación</Label>
                        <Input
                            id="location"
                            placeholder="Ej: Planta Baja, Piso 2"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>
                            Métodos de Pago Permitidos <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="cash"
                                    checked={paymentMethods.cash}
                                    onCheckedChange={(checked) =>
                                        setPaymentMethods({ ...paymentMethods, cash: checked as boolean })
                                    }
                                />
                                <label htmlFor="cash" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Efectivo
                                </label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="card"
                                    checked={paymentMethods.card}
                                    onCheckedChange={(checked) =>
                                        setPaymentMethods({ ...paymentMethods, card: checked as boolean })
                                    }
                                />
                                <label htmlFor="card" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Tarjeta
                                </label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="transfer"
                                    checked={paymentMethods.transfer}
                                    onCheckedChange={(checked) =>
                                        setPaymentMethods({ ...paymentMethods, transfer: checked as boolean })
                                    }
                                />
                                <label htmlFor="transfer" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Transferencia
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="treasuryAccount">
                            Cuenta de Tesorería <span className="text-destructive">*</span>
                        </Label>
                        <Select value={defaultTreasuryAccount} onValueChange={setDefaultTreasuryAccount}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar cuenta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {compatibleAccounts.length === 0 ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                        No hay cuentas compatibles con los métodos seleccionados
                                    </div>
                                ) : (
                                    compatibleAccounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id.toString()}>
                                            {account.name} ({account.account_type})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Solo se muestran cuentas compatibles con los métodos de pago seleccionados
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="serialNumber">Número de Serie</Label>
                            <Input
                                id="serialNumber"
                                placeholder="Ej: SN-12345"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ipAddress">Dirección IP</Label>
                            <Input
                                id="ipAddress"
                                placeholder="Ej: 192.168.1.100"
                                value={ipAddress}
                                onChange={(e) => setIpAddress(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {terminal ? "Actualizar" : "Crear"} Terminal
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
