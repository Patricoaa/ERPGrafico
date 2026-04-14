"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
    Plus, Edit, Trash2, Loader2, CreditCard, Landmark, List, History, Tag, Pencil
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import api from "@/lib/api"
import { toast } from "sonner"
import { BaseModal } from "@/components/shared/BaseModal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

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
    onOpenChange?: (open: boolean) => void
}

export function BankManagement({ externalOpen, onOpenChange }: BankManagementProps) {
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

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/treasury/banks/${id}/`)
            toast.success("Banco eliminado")
            fetchBanks()
        } catch (error) {
            toast.error("Error al eliminar banco")
        }
    })

    const handleDelete = (id: number) => {
        deleteConfirm.requestConfirm(id)
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
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex items-center justify-center gap-2 w-full">
                    <DataCell.Text className="font-medium text-center">
                        <Landmark className="h-4 w-4 text-muted-foreground mr-2 inline" />
                        {row.original.name}
                    </DataCell.Text>
                </div>
            )
        },
        {
            accessorKey: "code",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex justify-center w-full">
                    <DataCell.Code>{row.original.code || 'N/A'}</DataCell.Code>
                </div>
            )
        },
        createActionsColumn<any>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar"
                        onClick={() => openEdit(item)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                    />
                </>
            )
        })
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
                cardMode
                isLoading={loading}
                searchPlaceholder="Buscar bancos..."
                filterColumn="name"
                useAdvancedFilter={true}
            />

            <BankDialog
                open={dialogOpen || !!externalOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) {
                        setSelectedBank(null)
                        onOpenChange?.(false)
                    } else {
                        setDialogOpen(true)
                    }
                }}
                bank={selectedBank}
                onSuccess={() => {
                    setDialogOpen(false)
                    onOpenChange?.(false)
                    fetchBanks()
                }}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Banco"
                description="¿Está seguro de eliminar este banco? Esta acción no se puede deshacer."
                variant="destructive"
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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={bank ? "xl" : "md"}
            title={
                <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-muted-foreground" />
                    <span>{bank ? "Ficha de Banco" : "Nuevo Banco"}</span>
                </div>
            }
            description={bank ? "Modifique los datos del banco y revise su historial." : "Ingrese el nombre y código identificador del nuevo banco."}
            hideScrollArea={true}
            className="h-[80vh]"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <ActionSlideButton type="submit" form="bank-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {bank ? "Actualizar" : "Crear"}
                    </ActionSlideButton>
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden h-full">
                {/* Left Side: Form */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                    <form id="bank-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="bank-name" className={FORM_STYLES.label}>Nombre</Label>
                                <Input id="bank-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Banco de Chile" className={FORM_STYLES.input} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="bank-code" className={FORM_STYLES.label}>Código (Alias)</Label>
                                    <Input id="bank-code" value={code} onChange={e => setCode(e.target.value)} placeholder="Ej: BCHILE" className={FORM_STYLES.input} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="bank-swift" className={FORM_STYLES.label}>Código SWIFT/BIC</Label>
                                    <Input
                                        id="bank-swift"
                                        value={swiftCode}
                                        onChange={e => setSwiftCode(e.target.value)}
                                        placeholder="Ej: BCHICLRM"
                                        maxLength={11}
                                        className={FORM_STYLES.input}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">Código internacional para transferencias</p>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Right Side: Activity Sidebar */}
                {bank?.id && (
                    <ActivitySidebar
                            entityType="bank"
                            entityId={bank.id}
                            className="h-full border-none"
                            title="Historial"
                        />
                )}
            </div>
        </BaseModal>
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
    onOpenChange?: (open: boolean) => void
}

export function PaymentMethodManagement({ externalOpen, onOpenChange }: PaymentMethodManagementProps) {
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

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/treasury/payment-methods/${id}/`)
            toast.success("Método eliminado")
            fetchMethods()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    })

    const handleDelete = (id: number) => {
        deleteConfirm.requestConfirm(id)
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
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex items-center justify-center gap-2 w-full">
                    {row.original.is_terminal ? (
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col items-center">
                        <DataCell.Text className="font-medium text-center">{row.original.name}</DataCell.Text>
                        {row.original.is_terminal && (
                            <DataCell.Badge 
                                variant="outline" 
                                className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/5 border-primary/20 mt-0.5"
                            >
                                Terminal
                            </DataCell.Badge>
                        )}
                    </div>
                </div>
            )
        },
        {
            accessorKey: "method_type_display",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.original.method_type} label={row.original.method_type_display} size="sm" />
                </div>
            )
        },
        {
            accessorKey: "treasury_account_name",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Cuenta de Tesorería" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                    <DataCell.Secondary className="text-center">{row.original.treasury_account_name}</DataCell.Secondary>
                    <div className="flex justify-center gap-1">
                        {row.original.allow_for_sales && (
                            <DataCell.Badge 
                                variant="outline" 
                                className="text-[9px] px-1 h-3.5 bg-income/5 text-income border-income/10 font-black uppercase tracking-tighter"
                            >
                                Ventas
                            </DataCell.Badge>
                        )}
                        {row.original.allow_for_purchases && (
                            <DataCell.Badge 
                                variant="outline" 
                                className="text-[9px] px-1 h-3.5 bg-asset/5 text-asset border-asset/10 font-black uppercase tracking-tighter"
                            >
                                Compras
                            </DataCell.Badge>
                        )}
                    </div>
                </div>
            )
        },
        createActionsColumn<any>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar"
                        onClick={() => openEdit(item)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                    />
                </>
            )
        })
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
                cardMode
                isLoading={loading}
                searchPlaceholder="Buscar por nombre o cuenta..."
                filterColumn="name"
                useAdvancedFilter={true}
            />

            <PaymentMethodDialog
                open={dialogOpen || !!externalOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) {
                        setSelectedMethod(null)
                        onOpenChange?.(false)
                    } else {
                        setDialogOpen(true)
                    }
                }}
                method={selectedMethod}
                onSuccess={() => {
                    setDialogOpen(false)
                    onOpenChange?.(false)
                    fetchMethods()
                }}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Método de Pago"
                description="¿Está seguro de eliminar este método de pago? Esta acción no se puede deshacer."
                variant="destructive"
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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={method ? "xl" : "lg"}
            title={
                <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span>{method ? "Ficha de Método de Pago" : "Nuevo Método de Pago"}</span>
                </div>
            }
            description={method ? "Modifique el método de pago y revise su historial." : "Defina el método de pago vinculado a una cuenta de tesorería."}
            hideScrollArea={true}
            className="h-[85vh]"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <ActionSlideButton type="submit" form="method-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {method ? "Actualizar" : "Crear"}
                    </ActionSlideButton>
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden h-full">
                {/* Left Side: Form */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                    <form id="method-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label className={FORM_STYLES.label}>Nombre</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Visa Santander Debito" className={FORM_STYLES.input} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className={FORM_STYLES.label}>Tipo</Label>
                                    <Select value={type} onValueChange={handleTypeChange}>
                                        <SelectTrigger className={FORM_STYLES.input}>
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
                                    <Label className={FORM_STYLES.label}>Cuenta</Label>
                                    <Select value={accountId || ""} onValueChange={setAccountId}>
                                        <SelectTrigger className={FORM_STYLES.input}>
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
                            <div className="mt-4 p-4 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center gap-2 text-primary font-bold">
                                    <CreditCard className="h-4 w-4" /> Configuración de Recaudación
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs">Proveedor (Contacto)</Label>
                                    <Select value={cardProviderId || ""} onValueChange={setCardProviderId}>
                                        <SelectTrigger className={cn(FORM_STYLES.input, "bg-white")}>
                                            <SelectValue placeholder="Seleccionar contacto del proveedor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {cardProviders.map(prov => (
                                                <SelectItem key={prov.id} value={prov.id.toString()}>{prov.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
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
                {method?.id && (
                    <ActivitySidebar
                            entityType="paymentmethod"
                            entityId={method.id}
                            className="h-full border-none"
                            title="Historial"
                        />
                )}
            </div>
        </BaseModal>
    )
}


