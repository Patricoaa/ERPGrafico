"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

const accountSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    parent: z.string().optional().or(z.literal("")),
    is_category: z.string().optional().nullable().or(z.literal("")),
    cf_category: z.string().optional().nullable().or(z.literal("")),
    bs_category: z.string().optional().nullable().or(z.literal("")),
})

type AccountFormValues = z.infer<typeof accountSchema>

interface AccountFormProps {
    onSuccess?: () => void
    accounts?: any[]
    initialData?: any // Use any for initialData to avoid strict prop widening issues
    triggerText?: React.ReactNode
    triggerVariant?: "default" | "circular"
}

export function AccountForm({ onSuccess, accounts = [], initialData, triggerText = "Nueva Cuenta", triggerVariant = "default" }: AccountFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            code: initialData?.code || "",
            name: initialData?.name || "",
            account_type: (initialData?.account_type as any) || "ASSET",
            parent: initialData?.parent || undefined,
            is_category: (initialData as any)?.is_category || "",
            cf_category: (initialData as any)?.cf_category || "",
            bs_category: (initialData as any)?.bs_category || "",
        },
    })

    // Helper to find inherited category
    const getInheritedCategory = (parentId: string | undefined, type: 'is_category' | 'cf_category' | 'bs_category'): string | null => {
        if (!parentId || parentId === "__none__" || parentId === "none") return null;
        const parent = accounts.find(a => a.id.toString() === parentId);
        if (!parent) return null;
        if (parent[type]) return parent[type];
        return getInheritedCategory(parent.parent?.toString(), type);
    };

    const inheritedIsCategory = getInheritedCategory(form.watch("parent"), 'is_category');
    const inheritedCfCategory = getInheritedCategory(form.watch("parent"), 'cf_category');
    const inheritedBsCategory = getInheritedCategory(form.watch("parent"), 'bs_category');

    const accountType = form.watch("account_type");
    const isPLAccount = accountType === "INCOME" || accountType === "EXPENSE";

    // Reset form when opening or initialData changes
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    code: initialData.code,
                    name: initialData.name,
                    account_type: initialData.account_type as any,
                    parent: initialData.parent || undefined,
                    is_category: (initialData as any).is_category || "",
                    cf_category: (initialData as any).cf_category || "",
                })
            } else {
                form.reset({
                    code: "",
                    name: "",
                    account_type: "ASSET",
                    parent: undefined,
                    is_category: "",
                    cf_category: "",
                    bs_category: "",
                })
            }
        }
    }, [open, initialData, form])


    async function onSubmit(data: AccountFormValues) {
        setLoading(true)
        try {
            const payload = {
                ...data,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? data.parent : null,
                is_category: data.is_category || null,
                cf_category: data.cf_category || null,
                bs_category: data.bs_category || null,
            }

            if (initialData?.id) {
                await api.put(`/accounting/accounts/${initialData.id}/`, payload)
                toast.success("Cuenta actualizada")
            } else {
                await api.post('/accounting/accounts/', payload)
                toast.success("Cuenta creada")
            }

            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving account:", error)
            const detail = error.response?.data?.error || error.response?.data?.detail || "Error al guardar la cuenta"
            if (typeof detail === 'object') {
                // Format object errors
                const msg = Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(', ')
                toast.error(`Error: ${msg}`)
            } else {
                toast.error(detail)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerVariant === "circular" ? (
                    <Button size="icon" className="rounded-full h-8 w-8" title="Crear Cuenta Contable">
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant={initialData ? "ghost" : "default"} size={initialData ? "sm" : "default"}>
                        {triggerText}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent size="sm">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Cuenta" : "Crear Cuenta Contable"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los detalles de la cuenta contable." : "Ingrese los datos de la nueva cuenta del plan de cuentas."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={initialData ? "" : "Automático"}
                                            {...field}
                                            readOnly={!!initialData}
                                            className={initialData ? "bg-muted" : ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Caja" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="ASSET">Activo</SelectItem>
                                            <SelectItem value="LIABILITY">Pasivo</SelectItem>
                                            <SelectItem value="EQUITY">Patrimonio</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parent"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta Padre (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sin padre" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sin padre</SelectItem>
                                            {accounts.filter((acc: any) => acc.id).map((acc: any) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="is_category"
                                render={({ field }) => (
                                    <FormItem className={cn(!isPLAccount && "opacity-50 pointer-events-none")}>
                                        <FormLabel className="flex justify-between">
                                            <span>Mapeo EERR</span>
                                            {!isPLAccount && <span className="text-[10px] text-amber-600 font-normal">Solo Ingresos/Gastos</span>}
                                        </FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || ""}
                                            disabled={!isPLAccount}
                                        >
                                            <FormControl>
                                                <SelectTrigger className={cn(!field.value && inheritedIsCategory && "ring-1 ring-emerald-500/30 bg-emerald-50/10")}>
                                                    <SelectValue placeholder={inheritedIsCategory ? `Heredado (${inheritedIsCategory === 'REVENUE' ? 'Ingresos' : 'Ventas...'})` : "Sin mapeo"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Sin mapeo</SelectItem>
                                                <SelectItem value="REVENUE">Ingresos Operacionales</SelectItem>
                                                <SelectItem value="COST_OF_SALES">Costo de Ventas</SelectItem>
                                                <SelectItem value="OPERATING_EXPENSE">Gastos Operacionales</SelectItem>
                                                <SelectItem value="NON_OPERATING_REVENUE">Ingresos No Operacionales</SelectItem>
                                                <SelectItem value="NON_OPERATING_EXPENSE">Gastos No Operacionales</SelectItem>
                                                <SelectItem value="TAX_EXPENSE">Impuesto a la Renta</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!field.value && inheritedIsCategory && (
                                            <p className="text-[10px] text-emerald-600 italic mt-1">Heredado del padre</p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="cf_category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mapeo Flujo Caja</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger className={cn(!field.value && inheritedCfCategory && "ring-1 ring-emerald-500/30 bg-emerald-50/10")}>
                                                    <SelectValue placeholder={inheritedCfCategory ? "Heredado del padre" : "Sin mapeo"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Sin mapeo</SelectItem>
                                                <SelectItem value="OPERATING">Actividades Operativas</SelectItem>
                                                <SelectItem value="INVESTING">Actividades Inversión</SelectItem>
                                                <SelectItem value="FINANCING">Actividades Financiamiento</SelectItem>
                                                <SelectItem value="DEP_AMORT">Depreciación (Ajuste)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!field.value && inheritedCfCategory && (
                                            <p className="text-[10px] text-emerald-600 italic mt-1">Heredado del padre</p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="bs_category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mapeo Balance (Ratios)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <FormControl>
                                            <SelectTrigger className={cn(!field.value && inheritedBsCategory && "ring-1 ring-emerald-500/30 bg-emerald-50/10")}>
                                                <SelectValue placeholder={inheritedBsCategory ? "Heredado del padre" : "Sin mapeo"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Sin mapeo</SelectItem>
                                            <SelectItem value="CURRENT_ASSET">Activo Corriente</SelectItem>
                                            <SelectItem value="NON_CURRENT_ASSET">Activo No Corriente</SelectItem>
                                            <SelectItem value="CURRENT_LIABILITY">Pasivo Corriente</SelectItem>
                                            <SelectItem value="NON_CURRENT_LIABILITY">Pasivo No Corriente</SelectItem>
                                            <SelectItem value="EQUITY">Patrimonio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {!field.value && inheritedBsCategory && (
                                        <p className="text-[10px] text-emerald-600 italic mt-1">Heredado del padre</p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (initialData ? "Guardando..." : "Creando...") : (initialData ? "Guardar Cambios" : "Crear Cuenta")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
