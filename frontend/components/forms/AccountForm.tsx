"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Plus, BookOpen, Tag } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"

// ... imports remain mostly the same, removing Dialog specific ones
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
import { FORM_STYLES } from "@/lib/styles"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { AccountPayload } from "@/features/accounting/types"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"

const accountSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    parent: z.string().optional().or(z.literal("")),
    is_category: z.string().optional().nullable().or(z.literal("")),
    cf_category: z.string().optional().nullable().or(z.literal("")),
    bs_category: z.string().optional().nullable().or(z.literal("")),
    is_reconcilable: z.boolean(),
})

type AccountFormValues = z.infer<typeof accountSchema>

interface AccountFormProps {
    onSuccess?: () => void
    accounts?: any[]
    initialData?: any // Use any for initialData to avoid strict prop widening issues
    triggerText?: React.ReactNode
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AccountForm({
    onSuccess,
    accounts = [],
    initialData,
    triggerText = "Nueva Cuenta",
    triggerVariant = "default",
    open: openProp,
    onOpenChange
}: AccountFormProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = openProp !== undefined ? openProp : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    const { createAccount, updateAccount, isCreating, isUpdating } = useAccounts()
    const loading = isCreating || isUpdating

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
            is_reconcilable: initialData?.is_reconcilable || false,
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
                    is_reconcilable: initialData.is_reconcilable || false,
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
                    is_reconcilable: false,
                })
            }
        }
    }, [open, initialData, form])


    async function onSubmit(data: AccountFormValues) {
        try {
            const payload: AccountPayload = {
                code: data.code || "",
                name: data.name,
                account_type: data.account_type,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? Number(data.parent) : null,
                is_selectable: true, // Defaulting to true as it wasn't in schema explicitely but required by type
            }

            const extendedPayload = {
                ...payload,
                is_category: data.is_category || null,
                cf_category: data.cf_category || null,
                bs_category: data.bs_category || null,
                is_reconcilable: data.is_reconcilable
            }

            if (initialData?.id) {
                await updateAccount({ id: initialData.id, payload: extendedPayload as any })
            } else {
                await createAccount(extendedPayload as any)
            }

            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error) {
            console.error("Error saving account:", error)
        }
    }

    const Trigger = () => {
        if (openProp !== undefined) return null; // Controlled mode might not need internal trigger

        return triggerVariant === "circular" ? (
            <Button size="icon" className="rounded-full h-8 w-8" title="Crear Cuenta Contable" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
            </Button>
        ) : (
            <Button variant={initialData ? "ghost" : "default"} size={initialData ? "sm" : "default"} onClick={() => setOpen(true)}>
                {triggerText}
            </Button>
        )
    }

    return (
        <>
            <Trigger />
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size={initialData ? "lg" : "md"}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Tag className="h-5 w-5 text-primary" />
                        </div>
                        <span>{initialData ? "Ficha de Cuenta" : "Nueva Cuenta Contable"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {initialData?.code && (
                            <>
                                <span>{initialData.code}</span>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <span>{form.watch("name") || "Nueva Cuenta"}</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end space-x-2 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" form="account-form" disabled={loading}>
                            {loading ? (initialData ? "Guardando..." : "Creando...") : (initialData ? "Guardar Cambios" : "Crear Cuenta")}
                        </Button>
                    </div>
                }
            >
                <div className="flex-1 flex overflow-hidden min-h-[400px]">
                    <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                        <Form {...form}>
                            <form id="account-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4 pl-1 pb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Código</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={initialData ? "" : "Automático"}
                                                {...field}
                                                readOnly={!!initialData}
                                                className={cn(FORM_STYLES.input, initialData && "bg-muted")}
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
                                    <FormLabel className={FORM_STYLES.label}>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Caja" className={FORM_STYLES.input} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                            control={form.control}
                            name="account_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className={FORM_STYLES.input}>
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
                                    <FormLabel className={FORM_STYLES.label}>Cuenta Padre (Opcional)</FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            showAll={true}
                                            placeholder="Sin padre (Nivel raíz)"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                                </div>

                        <div className="flex items-center gap-2 pt-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mapeo Financiero</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="is_category"
                                render={({ field }) => (
                                    <FormItem className={cn(!isPLAccount && "opacity-50 pointer-events-none")}>
                                        <FormLabel className={FORM_STYLES.label + " flex justify-between"}>
                                            <span>Mapeo EERR</span>
                                            {!isPLAccount && <span className="text-[10px] text-amber-600 font-normal">Solo Ingresos/Gastos</span>}
                                        </FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || ""}
                                            disabled={!isPLAccount}
                                        >
                                            <FormControl>
                                                <SelectTrigger className={cn(FORM_STYLES.input, !field.value && inheritedIsCategory && "ring-1 ring-emerald-500/30 bg-emerald-50/10")}>
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
                                        <FormLabel className={FORM_STYLES.label}>Mapeo Flujo Caja</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger className={cn(FORM_STYLES.input, !field.value && inheritedCfCategory && "ring-1 ring-emerald-500/30 bg-emerald-50/10")}>
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
                                    <FormLabel className={FORM_STYLES.label}>Mapeo Balance (Ratios)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <FormControl>
                                            <SelectTrigger className={cn(FORM_STYLES.input, !field.value && inheritedBsCategory && "ring-1 ring-emerald-500/30 bg-emerald-50/10")}>
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

                        <FormField
                            control={form.control}
                            name="is_reconcilable"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-stone-50/50">
                                    <div className="space-y-0.5">
                                        <FormLabel className={FORM_STYLES.label}>Conciliable</FormLabel>
                                        <p className="text-[10px] text-muted-foreground">
                                            Permite conciliar movimientos bancarios o de caja con esta cuenta.
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                    </div>

                    {initialData?.id && (
                        <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                            <ActivitySidebar
                                entityId={initialData.id}
                                entityType="account"
                            />
                        </div>
                    )}
                </div>
            </BaseModal>
        </>
    )
}
