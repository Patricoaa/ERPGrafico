"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Check, Search, ChevronsUpDown, MonitorSmartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import { EmptyState } from "@/components/shared/EmptyState"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"

export interface Terminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number | null
    default_treasury_account_name?: string
    default_treasury_account_code?: string
    allowed_treasury_accounts: TreasuryAccount[]
    allowed_payment_methods: string[]
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

const formSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    location: z.string().optional(),
    serial_number: z.string().optional(),
    ip_address: z.string().optional(),
    allowed_treasury_account_ids: z.array(z.number()),
    default_treasury_account: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof formSchema>

export function TerminalFormDialog({ open, onOpenChange, terminal, onSuccess }: TerminalFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            code: "",
            location: "",
            serial_number: "",
            ip_address: "",
            allowed_treasury_account_ids: [],
            default_treasury_account: "",
        },
    })

    useEffect(() => {
        if (open) {
            fetchTreasuryAccounts()

            if (terminal) {
                const allowedIds = terminal.allowed_treasury_accounts?.map(acc => acc.id) || []
                form.reset({
                    name: terminal.name || "",
                    code: terminal.code || "",
                    location: terminal.location || "",
                    serial_number: terminal.serial_number || "",
                    ip_address: terminal.ip_address || "",
                    allowed_treasury_account_ids: allowedIds,
                    default_treasury_account: terminal.default_treasury_account?.toString() || "",
                })
            } else {
                form.reset({
                    name: "",
                    code: "",
                    location: "",
                    serial_number: "",
                    ip_address: "",
                    allowed_treasury_account_ids: [],
                    default_treasury_account: "",
                })
            }
        }
    }, [open, terminal, form])

    const fetchTreasuryAccounts = async () => {
        try {
            const res = await api.get('/treasury/accounts/')
            const allAccounts = res.data.results || res.data
            const validAccounts = allAccounts.filter((a: TreasuryAccount) =>
                a.allows_cash || a.allows_card || a.allows_transfer
            )
            setTreasuryAccounts(validAccounts)
        } catch (error) {
            console.error("Error fetching treasury accounts", error)
            toast.error("Error al cargar cuentas de tesorería")
        }
    }

    const toggleAccountSelection = (accountId: number, currentSelections: number[], onChange: (val: number[]) => void, defaultAccountValue: string | null | undefined, setDefaultAccount: (val: string) => void) => {
        const account = treasuryAccounts.find(a => a.id === accountId)
        const isSelected = currentSelections.includes(accountId)

        if (!isSelected) {
            if (account?.allows_cash) {
                const hasCashDetails = treasuryAccounts
                    .filter(a => currentSelections.includes(a.id) && a.allows_cash)

                if (hasCashDetails.length > 0) {
                    toast.warning("Solo se permite una cuenta de efectivo por terminal.")
                    return
                }
            }
            onChange([...currentSelections, accountId])
        } else {
            if (defaultAccountValue === accountId.toString()) {
                setDefaultAccount("")
            }
            onChange(currentSelections.filter(id => id !== accountId))
        }
    }

    const onSubmit = async (data: FormValues) => {
        if (data.allowed_treasury_account_ids.length === 0) {
            toast.error("Seleccione al menos una cuenta de tesorería")
            return
        }

        const cashAccountsCount = treasuryAccounts
            .filter(a => data.allowed_treasury_account_ids.includes(a.id) && a.allows_cash).length

        if (cashAccountsCount > 1) {
            toast.error("Solo puede haber una cuenta de Efectivo vinculada.")
            return
        }

        const payload = {
            name: data.name,
            code: data.code,
            location: data.location,
            allowed_treasury_account_ids: data.allowed_treasury_account_ids,
            default_treasury_account: (data.default_treasury_account && data.default_treasury_account !== "__none__") ? parseInt(data.default_treasury_account) : null,
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
        } catch (error: unknown) {
            console.error(error)
            toast.error("Error al guardar terminal")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={terminal ? "lg" : "md"}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <MonitorSmartphone className="h-5 w-5 text-primary" />
                    </div>
                    <span>{terminal ? "Ficha de Terminal" : "Nuevo Terminal"}</span>
                </div>
            }
            description={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {terminal?.code && (
                        <>
                            <span>{terminal.code}</span>
                            <span className="opacity-30">|</span>
                        </>
                    )}
                    <span>{form.watch("name") || "Configuración básica del TPV"}</span>
                </div>
            }
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="terminal-form" disabled={loading}>
                        {loading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        {terminal ? "Guardar Cambios" : "Crear Terminal"}
                    </Button>
                </div>
            }
        >
            <div className="flex-1 flex overflow-hidden min-h-[400px]">
                <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                    <Form {...form}>
                        <form id="terminal-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4 pl-1 pb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Nombre</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Caja Principal" className={FORM_STYLES.input} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Código</FormLabel>
                                            <FormControl>
                                                <Input placeholder="TERM-01" className={cn(FORM_STYLES.input, "uppercase")} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="serial_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>N° Serie</FormLabel>
                                            <FormControl>
                                                <Input placeholder="SN-XXXX" className={FORM_STYLES.input} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ip_address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>IP / Red</FormLabel>
                                            <FormControl>
                                                <Input placeholder="192.168.1.XX" className={FORM_STYLES.input} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Ubicación (Opcional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Entrada Principal" className={FORM_STYLES.input} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="allowed_treasury_account_ids"
                                render={({ field }) => (
                                    <FormItem className="space-y-2 border rounded-xl p-4 bg-muted/10 shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <FormLabel className={cn(FORM_STYLES.label, "mb-0")}>Cuentas Permitidas</FormLabel>
                                            <Badge variant="secondary" className="font-mono">{field.value.length} SELECCIONADAS</Badge>
                                        </div>
                                        <div className="h-40 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                            {treasuryAccounts.length === 0 ? (
                                                <EmptyState context="finance" variant="minimal" description="No hay cuentas configuradas" />
                                            ) : (
                                                treasuryAccounts.map((account) => {
                                                    const isSelected = field.value.includes(account.id)
                                                    return (
                                                        <div
                                                            key={account.id}
                                                            className={cn(
                                                                "flex items-center space-x-3 p-2 rounded-lg cursor-pointer border transition-all duration-200",
                                                                isSelected ? 'bg-primary/5 border-primary/30 shadow-sm' : 'hover:bg-accent border-transparent'
                                                            )}
                                                            onClick={() => toggleAccountSelection(
                                                                account.id,
                                                                field.value,
                                                                field.onChange,
                                                                form.getValues("default_treasury_account"),
                                                                (val) => form.setValue("default_treasury_account", val)
                                                            )}
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleAccountSelection(
                                                                    account.id,
                                                                    field.value,
                                                                    field.onChange,
                                                                    form.getValues("default_treasury_account"),
                                                                    (val) => form.setValue("default_treasury_account", val)
                                                                )}
                                                                className="h-4 w-4"
                                                            />
                                                            <div className="flex-1 flex items-center justify-between">
                                                                <span className="font-semibold text-sm text-foreground/90">{account.name}</span>
                                                                <div className="flex gap-1.5">
                                                                    {account.allows_cash && <Badge variant="outline" className="text-[10px] px-1.5 h-5 font-medium text-emerald-700 bg-emerald-50 border-emerald-200">Efectivo</Badge>}
                                                                    {account.allows_card && <Badge variant="outline" className="text-[10px] px-1.5 h-5 font-medium text-primary bg-blue-50 border-blue-200">Tarjeta</Badge>}
                                                                    {account.allows_transfer && <Badge variant="outline" className="text-[10px] px-1.5 h-5 font-medium text-primary bg-primary/10 border-primary/20">Transf</Badge>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {form.watch("allowed_treasury_account_ids").length > 0 && (
                                <FormField
                                    control={form.control}
                                    name="default_treasury_account"
                                    render={({ field }) => (
                                        <FormItem className="pt-2">
                                            <FormLabel className={FORM_STYLES.label}>Cuenta Predeterminada (Inicio de Sesión)</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(FORM_STYLES.input, "w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                                                        >
                                                            {field.value === "__none__" || !field.value
                                                                ? "Seleccione una cuenta predeterminada"
                                                                : treasuryAccounts.find(acc => acc.id.toString() === field.value)?.name || "Seleccione..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                    <div className="p-2">
                                                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background focus-within:ring-1 focus-within:ring-primary/30">
                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                            <input
                                                                className={cn("flex h-9 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground")}
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
                                                                    field.value === "__none__" && "bg-accent text-accent-foreground font-bold"
                                                                )}
                                                                onClick={() => {
                                                                    field.onChange("__none__")
                                                                    document.body.click() // Close popover trick
                                                                }}
                                                            >
                                                                <span>-- Ninguna (Pedir al iniciar) --</span>
                                                                {field.value === "__none__" && <Check className="ml-auto h-4 w-4 opacity-100" />}
                                                            </div>
                                                            {treasuryAccounts
                                                                .filter(acc => form.watch("allowed_treasury_account_ids").includes(acc.id))
                                                                .map((account) => (
                                                                    <div
                                                                        key={account.id}
                                                                        className={cn(
                                                                            "account-popover-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                            field.value === account.id.toString() && "bg-accent text-accent-foreground font-bold"
                                                                        )}
                                                                        onClick={() => {
                                                                            field.onChange(account.id.toString())
                                                                            document.body.click()
                                                                        }}
                                                                    >
                                                                        <span>{account.name}</span>
                                                                        {field.value === account.id.toString() && (
                                                                            <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </form>
                    </Form>
                </div>

                {terminal?.id && (
                    <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                        <ActivitySidebar
                            entityId={terminal.id}
                            entityType="terminal"
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
