"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Plus, Edit2, Trash2, Loader2, CreditCard, Landmark, List, History } from "lucide-react"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import api from "@/lib/api"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { ProductSelector } from "@/components/selectors/ProductSelector"

// --- Bank Management ---

interface Bank {
    id: number
    name: string
    code: string | null
    swift_code?: string | null
    is_active: boolean
}

interface BankManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function BankManagement({ externalOpen, onExternalOpenChange }: BankManagementProps) {
    const [banks, setBanks] = useState<Bank[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)

    const fetchBanks = async () => {
        setLoading(true)
        try {
            const response = await api.get("/treasury/banks/")
            setBanks(response.data)
        } catch (error) {
            toast.error("Error al cargar bancos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBanks()
    }, [])

    useEffect(() => {
        if (externalOpen) {
            openCreate()
        }
    }, [externalOpen])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este banco?")) return
        try {
            await api.delete(`/treasury/banks/${id}/`)
            toast.success("Banco eliminado")
            fetchBanks()
        } catch (error) {
            toast.error("Error al eliminar banco")
        }
    }

    const openCreate = () => {
        setSelectedBank(null)
        setDialogOpen(true)
    }

    const openEdit = (bank: Bank) => {
        setSelectedBank(bank)
        setDialogOpen(true)
    }

    const columns = [
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{row.original.name}</span>
                </div>
            )
        },
        {
            accessorKey: "code",
            header: "Código",
            cell: ({ row }: any) => <Badge variant="outline" className="font-mono text-[10px]">{row.original.code || 'N/A'}</Badge>
        },
        {
            id: "actions",
            cell: ({ row }: any) => (
                <div className="flex justify-end space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-primary/10 hidden">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Landmark className="h-5 w-5" /> Gestión de Bancos
                    </h2>
                    <p className="text-sm text-muted-foreground">Administre las entidades bancarias globales.</p>
                </div>
                <Button onClick={openCreate} className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Banco
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={banks}
                searchPlaceholder="Buscar bancos..."
                filterColumn="name"
                useAdvancedFilter={true}
            />

            <BankDialog
                open={dialogOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                bank={selectedBank}
                onSuccess={() => {
                    setDialogOpen(false)
                    onExternalOpenChange?.(false)
                    fetchBanks()
                }}
            />
        </div>
    )
}

function BankDialog({ open, onOpenChange, bank, onSuccess }: any) {
    const [name, setName] = useState("")
    const [code, setCode] = useState("")
    const [swiftCode, setSwiftCode] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setName(bank?.name || "")
            setCode(bank?.code || "")
            setSwiftCode(bank?.swift_code || "")
        }
    }, [open, bank])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = { name, code, swift_code: swiftCode }
            if (bank) {
                await api.patch(`/treasury/banks/${bank.id}/`, payload)
                toast.success("Banco actualizado")
            } else {
                await api.post("/treasury/banks/", payload)
                toast.success("Banco creado")
            }
            onSuccess()
        } catch (error) {
            toast.error("Error al guardar banco")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{bank ? "Editar Banco" : "Nuevo Banco"}</DialogTitle>
                    <DialogDescription>
                        {bank ? "Modifique los datos del banco y revise su historial." : "Ingrese el nombre y código identificador del nuevo banco."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side: Form */}
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                        <form id="bank-form" onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="bank-name">Nombre</Label>
                                    <Input id="bank-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Banco de Chile" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="bank-code">Código (Alias)</Label>
                                    <Input id="bank-code" value={code} onChange={e => setCode(e.target.value)} placeholder="Ej: BCHILE" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="bank-swift">Código SWIFT/BIC</Label>
                                    <Input
                                        id="bank-swift"
                                        value={swiftCode}
                                        onChange={e => setSwiftCode(e.target.value)}
                                        placeholder="Ej: BCHICLRM"
                                        maxLength={11}
                                    />
                                    <p className="text-xs text-muted-foreground">Código internacional para transferencias</p>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Right Side: Activity Sidebar */}
                    <div className="w-[320px] flex flex-col bg-muted/10 border-l overflow-hidden">
                        {bank ? (
                            <ActivitySidebar
                                entityType="bank"
                                entityId={bank.id}
                                className="h-full border-none"
                                title="Historial"
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                <History className="h-10 w-10 mb-3 opacity-20" />
                                <p className="text-sm">El historial estará disponible una vez creado el banco.</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-white z-10">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="bank-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {bank ? "Actualizar" : "Crear"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// --- Payment Method Management ---

interface PaymentMethod {
    id: number
    name: string
    method_type: string
    method_type_display: string
    treasury_account: number
    treasury_account_name: string
    is_active: boolean
    requires_reference: boolean
    allow_for_sales: boolean
    allow_for_purchases: boolean
    is_terminal: boolean
    supplier: number | null
    supplier_name: string | null
    terminal_receivable_account: number | null
    terminal_receivable_account_name: string | null
    commission_expense_account: number | null
    commission_expense_account_name: string | null
}

interface PaymentMethodManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function PaymentMethodManagement({ externalOpen, onExternalOpenChange }: PaymentMethodManagementProps) {
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)

    const fetchMethods = async () => {
        setLoading(true)
        try {
            const response = await api.get("/treasury/payment-methods/")
            setMethods(response.data)
        } catch (error) {
            toast.error("Error al cargar métodos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMethods()
    }, [])

    useEffect(() => {
        if (externalOpen) {
            openCreate()
        }
    }, [externalOpen])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este método de pago?")) return
        try {
            await api.delete(`/treasury/payment-methods/${id}/`)
            toast.success("Método eliminado")
            fetchMethods()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    }

    const openCreate = () => {
        setSelectedMethod(null)
        setDialogOpen(true)
    }

    const openEdit = (method: PaymentMethod) => {
        setSelectedMethod(method)
        setDialogOpen(true)
    }

    const columns = [
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    {row.original.is_terminal ? (
                        <div className="bg-primary/10 p-1 rounded" title="Terminal de Cobro">
                            <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                    ) : (
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.name}</span>
                        {row.original.is_terminal && <span className="text-[10px] text-primary font-semibold uppercase">Terminal</span>}
                    </div>
                </div>
            )
        },
        {
            accessorKey: "method_type_display",
            header: "Tipo",
            cell: ({ row }: any) => <Badge variant="secondary">{row.original.method_type_display}</Badge>
        },
        {
            accessorKey: "treasury_account_name",
            header: "Cuenta de Tesorería",
            cell: ({ row }: any) => (
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{row.original.treasury_account_name}</span>
                    <div className="flex gap-1">
                        {row.original.allow_for_sales && <Badge variant="outline" className="text-[9px] px-1 h-4 bg-green-50 text-green-700 border-green-200">Ventas</Badge>}
                        {row.original.allow_for_purchases && <Badge variant="outline" className="text-[9px] px-1 h-4 bg-blue-50 text-blue-700 border-blue-200">Compras</Badge>}
                    </div>
                </div>
            )
        },
        {
            id: "actions",
            cell: ({ row }: any) => (
                <div className="flex justify-end space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-primary/10 hidden">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Métodos de Pago
                    </h2>
                    <p className="text-sm text-muted-foreground">Configure los métodos de pago habilitados por cuenta.</p>
                </div>
                <Button onClick={openCreate} className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Método
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={methods}
                searchPlaceholder="Buscar por nombre o cuenta..."
                filterColumn="name"
                useAdvancedFilter={true}
            />

            <PaymentMethodDialog
                open={dialogOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                method={selectedMethod}
                onSuccess={() => {
                    setDialogOpen(false)
                    onExternalOpenChange?.(false)
                    fetchMethods()
                }}
            />
        </div>
    )
}

function PaymentMethodDialog({ open, onOpenChange, method, onSuccess }: any) {
    const [name, setName] = useState("")
    const [type, setType] = useState("DEBIT_CARD")
    const [accountId, setAccountId] = useState<string | null>(null)
    const [requiresRef, setRequiresRef] = useState(false)
    const [allowSales, setAllowSales] = useState(true)
    const [allowPurchases, setAllowPurchases] = useState(true)
    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [cardProviders, setCardProviders] = useState<any[]>([])
    const [cardProviderId, setCardProviderId] = useState<string | null>(null)
    const [isTerminal, setIsTerminal] = useState(false)
    const [terminalReceivableAccount, setTerminalReceivableAccount] = useState<string | null>(null)
    const [commissionExpenseAccount, setCommissionExpenseAccount] = useState<string | null>(null)
    const [commissionProductId, setCommissionProductId] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [accRes, contactRes] = await Promise.all([
                    api.get("/treasury/accounts/"),
                    api.get("/contacts/?is_supplier=true")
                ])
                setAccounts(accRes.data)
                setCardProviders(contactRes.data)
            } catch (err) { }
        }
        fetchData()
    }, [])

    useEffect(() => {
        if (open) {
            setName(method?.name || "")
            setType(method?.method_type || "DEBIT_CARD")

            // Handle both ID and object cases for initialization
            const acc = method?.treasury_account
            setAccountId(acc ? (typeof acc === 'object' ? acc.id.toString() : acc.toString()) : null)

            setRequiresRef(method?.requires_reference || false)
            setAllowSales(method?.allow_for_sales ?? true)
            setAllowPurchases(method?.allow_for_purchases ?? true)
            setCardProviderId(method?.contact_id?.toString() || (method as any)?.supplier?.toString() || null)
            setIsTerminal(method?.is_terminal || false)
            setTerminalReceivableAccount(method?.terminal_receivable_account ? method.terminal_receivable_account.toString() : null)
            setCommissionExpenseAccount(method?.commission_expense_account ? method.commission_expense_account.toString() : null)
            setCommissionProductId(method?.commission_product ? method.commission_product.toString() : null)
        }
    }, [open, method])

    // Logic for auto-setting terminal when type is CARD_TERMINAL
    const handleTypeChange = (newType: string) => {
        setType(newType)
        if (newType === 'CARD_TERMINAL') {
            setIsTerminal(true)
            setAllowSales(true)
            setAllowPurchases(false)
        } else if (newType === 'DEBIT_CARD' || newType === 'CREDIT_CARD') {
            setIsTerminal(false)
            setAllowSales(false)
            setAllowPurchases(true)
        } else {
            // CASH, TRANSFER, CHECK
            setIsTerminal(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!accountId) {
            toast.error("Debe seleccionar una cuenta")
            return
        }
        setLoading(true)
        try {
            const payload = {
                name,
                method_type: type,
                treasury_account: accountId,
                requires_reference: requiresRef,
                allow_for_sales: allowSales,
                allow_for_purchases: allowPurchases,
                is_terminal: isTerminal,
                supplier: isTerminal ? cardProviderId : null,
                terminal_receivable_account: isTerminal ? terminalReceivableAccount : null,
                commission_expense_account: isTerminal ? commissionExpenseAccount : null,
                commission_product: isTerminal ? commissionProductId : null
            }
            if (method) {
                await api.patch(`/treasury/payment-methods/${method.id}/`, payload)
                toast.success("Método actualizado")
            } else {
                await api.post("/treasury/payment-methods/", payload)
                toast.success("Método creado")
            }
            onSuccess()
        } catch (error) {
            toast.error("Error al guardar método")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1000px] h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{method ? "Editar Método de Pago" : "Nuevo Método de Pago"}</DialogTitle>
                    <DialogDescription>
                        {method ? "Modifique el método de pago y revise su historial." : "Defina el método de pago vinculado a una cuenta de tesorería."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side: Form */}
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                        <form id="method-form" onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Nombre</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Visa Santander Debito" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Tipo</Label>
                                        <Select value={type} onValueChange={handleTypeChange}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CASH">Efectivo</SelectItem>
                                                <SelectItem value="CARD_TERMINAL" className="font-bold text-primary">Terminal de Cobros</SelectItem>
                                                <SelectItem value="DEBIT_CARD">Tarjeta de Débito</SelectItem>
                                                <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                                                <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                                <SelectItem value="CHECK">Cheque</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Cuenta</Label>
                                        <Select value={accountId || ""} onValueChange={setAccountId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="allow-sales" checked={allowSales} onCheckedChange={(v) => {
                                            if (type === 'DEBIT_CARD' || type === 'CREDIT_CARD') {
                                                toast.error("Tarjetas propias son solo para compras")
                                                return
                                            }
                                            setAllowSales(!!v)
                                        }} />
                                        <Label htmlFor="allow-sales" className="text-sm cursor-pointer">Permitir para ventas</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="allow-purchases" checked={allowPurchases} onCheckedChange={(v) => {
                                            if (type === 'CARD_TERMINAL') {
                                                toast.error("Terminales de cobro son solo para ventas")
                                                return
                                            }
                                            setAllowPurchases(!!v)
                                        }} />
                                        <Label htmlFor="allow-purchases" className="text-sm cursor-pointer">Permitir para compras</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 col-span-2 pt-2 border-t mt-1 hidden">
                                        <Checkbox id="req-ref" checked={requiresRef} onCheckedChange={(v) => setRequiresRef(!!v)} />
                                        <Label htmlFor="req-ref" className="text-sm cursor-pointer">¿Requiere N° Transacción?</Label>
                                    </div>
                                </div>
                            </div>
                            {type === 'CARD_TERMINAL' && (
                                <div className="mt-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-2 text-primary font-bold">
                                        <CreditCard className="h-4 w-4" /> Configuración de Recaudación
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs">Proveedor (Contacto)</Label>
                                        <Select value={cardProviderId || ""} onValueChange={setCardProviderId}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Seleccionar contacto del proveedor..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cardProviders.map(prov => (
                                                    <SelectItem key={prov.id} value={prov.id.toString()}>{prov.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground text-center">
                                            Entidad que procesa los pagos (ej: Transbank, Mercado Pago).
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-xs">Cuenta Por Cobrar Terminal</Label>
                                        <AccountSelector
                                            value={terminalReceivableAccount}
                                            onChange={(val) => setTerminalReceivableAccount(val)}
                                            accountType="ASSET"
                                            isReconcilable={true}
                                            placeholder="Seleccione cuenta transitoria..."
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Cuenta transitoria donde se acumulan las ventas hasta que el proveedor liquida.
                                            (Ej: 1-1-004 Por Cobrar Transbank)
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-xs">Cuenta Gasto Comisión</Label>
                                        <AccountSelector
                                            value={commissionExpenseAccount}
                                            onChange={(val) => setCommissionExpenseAccount(val)}
                                            accountType="EXPENSE"
                                            placeholder="Seleccione cuenta de gasto..."
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Cuenta de gasto donde se registrarán las comisiones.
                                            (Ej: 5-1-003 Comisiones Transbank)
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-xs">Producto de Servicio (Comisión)</Label>
                                        <ProductSelector
                                            value={commissionProductId}
                                            onChange={(val) => setCommissionProductId(val)}
                                            placeholder="Seleccione servicio de comisión..."
                                            productType="SERVICE"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Servicio utilizado para facturar las comisiones en la factura mensual.
                                        </p>
                                    </div>

                                    <p className="text-[10px] text-muted-foreground leading-relaxed italic border-t border-primary/10 pt-2 mt-2">
                                        * Al ser un terminal, los pagos no se reflejarán inmediatamente en el saldo bancario,
                                        sino como cuentas por cobrar al proveedor hasta su liquidación.
                                    </p>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Right Side: Activity Sidebar */}
                    <div className="w-[350px] flex flex-col bg-muted/10 border-l overflow-hidden">
                        {method ? (
                            <ActivitySidebar
                                entityType="paymentmethod"
                                entityId={method.id}
                                className="h-full border-none"
                                title="Historial"
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                <History className="h-10 w-10 mb-3 opacity-20" />
                                <p className="text-sm">El historial estará disponible una vez creado el método.</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-white z-10">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="method-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {method ? "Actualizar" : "Crear"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
