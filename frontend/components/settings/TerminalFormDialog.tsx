"use client"

import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Check, Search, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Terminal {
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


export interface TreasuryAccount {
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
            const allAccounts = res.data.results || res.data
            // Filter: Only accounts with at least one payment method
            const validAccounts = allAccounts.filter((a: TreasuryAccount) =>
                a.allows_cash || a.allows_card || a.allows_transfer
            )
            setTreasuryAccounts(validAccounts)
        } catch (error) {
            console.error("Error fetching treasury accounts", error)
            toast.error("Error al cargar cuentas de tesorería")
        }
    }

    const toggleAccountSelection = (accountId: number) => {
        // Find account to check type
        const account = treasuryAccounts.find(a => a.id === accountId)

        setSelectedAccountIds(prev => {
            const isSelected = prev.includes(accountId)

            if (!isSelected) {
                // Pre-validation: If selecting a CASH account, check if one is already selected
                if (account?.allows_cash) {
                    const hasCashDetails = treasuryAccounts
                        .filter(a => prev.includes(a.id) && a.allows_cash)

                    if (hasCashDetails.length > 0) {
                        toast.warning("Solo se permite una cuenta de efectivo por terminal.")
                        return prev
                    }
                }
                return [...prev, accountId]
            } else {
                // Deselecting
                if (defaultTreasuryAccount === accountId.toString()) {
                    setDefaultTreasuryAccount("")
                }
                return prev.filter(id => id !== accountId)
            }
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name || !code) {
            toast.error("Complete los campos obligatorios")
            return
        }

        if (selectedAccountIds.length === 0) {
            toast.error("Seleccione al menos una cuenta de tesorería")
            return
        }

        // Final validation for single cash account
        const cashAccountsCount = treasuryAccounts
            .filter(a => selectedAccountIds.includes(a.id) && a.allows_cash).length

        if (cashAccountsCount > 1) {
            toast.error("Solo puede haber una cuenta de Efectivo vinculada.")
            return
        }

        const payload = {
            name,
            code,
            location,
            allowed_treasury_account_ids: selectedAccountIds,
            default_treasury_account: (defaultTreasuryAccount && defaultTreasuryAccount !== "__none__") ? parseInt(defaultTreasuryAccount) : null,
            is_active: true
        }

        try {
            setLoading(true)
            if (terminal) {
                await api.patch(`/treasury/pos-terminals/${terminal.id}/`, payload)
                toast.success("Terminal actualizado")
            } else {
                await api.post('/treasury/pos-terminals/', payload)
                toast.success("Terminal creado")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error("Error al guardar terminal")
        } finally {
            setLoading(false)
        }
    }

    // Computed payment methods for display
    const derivedPaymentMethods = treasuryAccounts
        .filter(acc => selectedAccountIds.includes(acc.id))
        .reduce((methods, acc) => {
            if (acc.allows_cash && !methods.includes('Efectivo')) methods.push('Efectivo')
            if (acc.allows_card && !methods.includes('Tarjeta')) methods.push('Tarjeta')
            if (acc.allows_transfer && !methods.includes('Transferencia')) methods.push('Transferencia')
            return methods
        }, [] as string[])

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="md"
            title={terminal ? "Editar Terminal" : "Nuevo Terminal"}
            description="Configuración básica y cuentas asociadas."
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="terminal-form" size="sm" disabled={loading}>
                        {loading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        Guardar Cambios
                    </Button>
                </div>
            }
        >
            <form id="terminal-form" onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs font-semibold">Nombre <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="Ej: Caja Principal"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-8 text-sm"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="code" className="text-xs font-semibold">Código <span className="text-red-500">*</span></Label>
                        <Input
                            id="code"
                            placeholder="TERM-01"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="h-8 text-sm uppercase"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="location" className="text-xs font-semibold">Ubicación</Label>
                    <Input
                        id="location"
                        placeholder="Ej: Entrada Principal"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>

                <div className="space-y-2 border rounded-md p-3 bg-muted/10">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Cuentas Permitidas</Label>
                        <span className="text-[10px] text-muted-foreground">{selectedAccountIds.length} seleccionadas</span>
                    </div>

                    <div className="h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {treasuryAccounts.length === 0 ? (
                            <p className="text-xs text-center text-muted-foreground py-4">No hay cuentas configuradas</p>
                        ) : (
                            treasuryAccounts.map((account) => {
                                const isSelected = selectedAccountIds.includes(account.id)
                                return (
                                    <div
                                        key={account.id}
                                        className={`flex items-center space-x-2 p-1.5 rounded text-sm cursor-pointer border transition-colors ${isSelected ? 'bg-primary/5 border-primary/20' : 'hover:bg-accent border-transparent'}`}
                                        onClick={() => toggleAccountSelection(account.id)}
                                    >
                                        <Checkbox
                                            id={`account-${account.id}`}
                                            checked={isSelected}
                                            onCheckedChange={() => toggleAccountSelection(account.id)}
                                            className="h-4 w-4"
                                        />
                                        <div className="flex-1 flex items-center justify-between">
                                            <span className="font-medium text-xs truncate ml-2 text-foreground/90">{account.name}</span>
                                            <div className="flex gap-1 ml-2">
                                                {account.allows_cash && <Badge variant="secondary" className="text-[9px] px-1 h-4 font-normal text-emerald-600 bg-emerald-50 border-emerald-100">Efectivo</Badge>}
                                                {account.allows_card && <Badge variant="secondary" className="text-[9px] px-1 h-4 font-normal text-blue-600 bg-blue-50 border-blue-100">Tarjeta</Badge>}
                                                {account.allows_transfer && <Badge variant="secondary" className="text-[9px] px-1 h-4 font-normal text-purple-600 bg-purple-50 border-purple-100">Transf</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {selectedAccountIds.length > 0 && (
                    <div className="space-y-1.5">
                        <Label htmlFor="defaultAccount" className="text-xs font-semibold">Cuenta Predeterminada (Inicio de Sesión)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between h-8 text-sm font-normal"
                                >
                                    {defaultTreasuryAccount === "__none__" || !defaultTreasuryAccount
                                        ? "Seleccionar..."
                                        : treasuryAccounts.find(acc => acc.id.toString() === defaultTreasuryAccount)?.name}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <div className="p-2">
                                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                        <input
                                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                            placeholder="Buscar cuenta..."
                                            onChange={(e) => {
                                                const val = e.target.value.toLowerCase()
                                                const inputs = document.querySelectorAll('.account-popover-item')
                                                inputs.forEach((el) => {
                                                    if (el.textContent?.toLowerCase().includes(val)) {
                                                        (el as HTMLElement).style.display = 'flex'
                                                    } else {
                                                        (el as HTMLElement).style.display = 'none'
                                                    }
                                                })
                                            }}
                                        />
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                                        <div
                                            className={cn(
                                                "account-popover-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                defaultTreasuryAccount === "__none__" && "bg-accent"
                                            )}
                                            onClick={() => {
                                                setDefaultTreasuryAccount("__none__")
                                                document.body.click()
                                            }}
                                        >
                                            <span>-- Ninguna --</span>
                                            {defaultTreasuryAccount === "__none__" && <Check className="ml-auto h-4 w-4 opacity-100" />}
                                        </div>
                                        {treasuryAccounts
                                            .filter(acc => selectedAccountIds.includes(acc.id))
                                            .map((account) => (
                                                <div
                                                    key={account.id}
                                                    className={cn(
                                                        "account-popover-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                        defaultTreasuryAccount === account.id.toString() && "bg-accent"
                                                    )}
                                                    onClick={() => {
                                                        setDefaultTreasuryAccount(account.id.toString())
                                                        document.body.click()
                                                    }}
                                                >
                                                    <span>{account.name}</span>
                                                    {defaultTreasuryAccount === account.id.toString() && (
                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </form>
        </BaseModal>
    )
}
