"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Check } from "lucide-react"

interface Terminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number | null  // Now nullable
    default_treasury_account_name?: string
    default_treasury_account_code?: string
    allowed_treasury_accounts: TreasuryAccount[]  // ManyToMany (read)
    allowed_payment_methods: string[]  // Computed (read-only)
    serial_number: string
    ip_address: string | null
    created_at?: string
    updated_at?: string
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
    const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([])  // ManyToMany selection
    const [defaultTreasuryAccount, setDefaultTreasuryAccount] = useState<string>("")  // Still nullable

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

                // Extract IDs from allowed_treasury_accounts
                const allowedIds = terminal.allowed_treasury_accounts?.map(acc => acc.id) || []
                setSelectedAccountIds(allowedIds)

                // Set default account (may be null)
                setDefaultTreasuryAccount(terminal.default_treasury_account?.toString() || "")
            } else {
                // Create mode - reset form
                setName("")
                setCode("")
                setLocation("")
                setSerialNumber("")
                setIpAddress("")
                setSelectedAccountIds([])
                setDefaultTreasuryAccount("")
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

    const toggleAccountSelection = (accountId: number) => {
        setSelectedAccountIds(prev => {
            if (prev.includes(accountId)) {
                // Deselecting - check if it's the default
                if (defaultTreasuryAccount === accountId.toString()) {
                    setDefaultTreasuryAccount("")  // Clear default if deselected
                }
                return prev.filter(id => id !== accountId)
            } else {
                return [...prev, accountId]
            }
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!name || !code) {
            toast.error("Complete los campos obligatorios (Nombre y Código)")
            return
        }

        if (selectedAccountIds.length === 0) {
            toast.error("Seleccione al menos una cuenta de tesorería")
            return
        }

        // Validate default account is in selected accounts
        if (defaultTreasuryAccount && !selectedAccountIds.includes(parseInt(defaultTreasuryAccount))) {
            toast.error("La cuenta predeterminada debe estar entre las cuentas seleccionadas")
            return
        }

        const payload = {
            name,
            code,
            location,
            serial_number: serialNumber,
            ip_address: ipAddress || null,
            allowed_treasury_account_ids: selectedAccountIds,  // Write field (IDs)
            default_treasury_account: defaultTreasuryAccount ? parseInt(defaultTreasuryAccount) : null,
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
                } else if (errors.allowed_treasury_account_ids) {
                    toast.error(`${errors.allowed_treasury_account_ids}`)
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

    // Get payment methods for visual display based on selected accounts
    const derivedPaymentMethods = treasuryAccounts
        .filter(acc => selectedAccountIds.includes(acc.id))
        .reduce((methods, acc) => {
            if (acc.allows_cash && !methods.includes('Efectivo')) methods.push('Efectivo')
            if (acc.allows_card && !methods.includes('Tarjeta')) methods.push('Tarjeta')
            if (acc.allows_transfer && !methods.includes('Transferencia')) methods.push('Transferencia')
            return methods
        }, [] as string[])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{terminal ? "Editar Terminal" : "Nuevo Terminal"}</DialogTitle>
                    <DialogDescription>
                        Configure un terminal y asigne las cuentas de tesorería que puede utilizar
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

                    {/* Multi-select Treasury Accounts */}
                    <div className="space-y-2">
                        <Label>
                            Cuentas de Tesorería Permitidas <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Seleccione las cuentas que este terminal puede utilizar
                        </p>
                        <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                            {treasuryAccounts.length === 0 ? (
                                <p className="text-sm text-center text-muted-foreground py-4">
                                    No hay cuentas disponibles
                                </p>
                            ) : (
                                treasuryAccounts.map((account) => (
                                    <div
                                        key={account.id}
                                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                                        onClick={() => toggleAccountSelection(account.id)}
                                    >
                                        <Checkbox
                                            id={`account-${account.id}`}
                                            checked={selectedAccountIds.includes(account.id)}
                                            onCheckedChange={() => toggleAccountSelection(account.id)}
                                        />
                                        <label
                                            htmlFor={`account-${account.id}`}
                                            className="flex-1 text-sm font-medium leading-none cursor-pointer"
                                        >
                                            {account.name}
                                            <span className="text-xs text-muted-foreground ml-2">
                                                ({account.account_type})
                                            </span>
                                        </label>
                                        <div className="flex gap-1">
                                            {account.allows_cash && <Badge variant="outline" className="text-[10px] px-1">Efectivo</Badge>}
                                            {account.allows_card && <Badge variant="outline" className="text-[10px] px-1">Tarjeta</Badge>}
                                            {account.allows_transfer && <Badge variant="outline" className="text-[10px] px-1">Transf</Badge>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {selectedAccountIds.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                                {selectedAccountIds.length} cuenta(s) seleccionada(s)
                            </p>
                        )}
                    </div>

                    {/* Computed Payment Methods Display */}
                    {derivedPaymentMethods.length > 0 && (
                        <div className="bg-muted/50 border rounded-lg p-3 space-y-2">
                            <Label className="text-xs font-semibold">Métodos de Pago Disponibles (Auto-calculado):</Label>
                            <div className="flex gap-2 flex-wrap">
                                {derivedPaymentMethods.map(method => (
                                    <Badge key={method} variant="secondary" className="text-xs">
                                        <Check className="h-3 w-3 mr-1" />
                                        {method}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Default Account Selection (Optional) */}
                    {selectedAccountIds.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="defaultAccount">
                                Cuenta Predeterminada (Opcional)
                            </Label>
                            <Select value={defaultTreasuryAccount} onValueChange={setDefaultTreasuryAccount}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Ninguna (el cajero elige al iniciar sesión)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Ninguna</SelectItem>
                                    {treasuryAccounts
                                        .filter(acc => selectedAccountIds.includes(acc.id))
                                        .map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name} ({account.account_type})
                                            </SelectItem>
                                        ))
                                    }
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Se mostrará por defecto al iniciar sesión en este terminal
                            </p>
                        </div>
                    )}

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
