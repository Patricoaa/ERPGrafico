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
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

const accountSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    parent: z.string().optional().or(z.literal("")),
})

type AccountFormValues = z.infer<typeof accountSchema>

interface AccountFormProps {
    auditSidebar?: React.ReactNode
    onSuccess?: () => void
    accounts?: Record<string, unknown>[]
    initialData?: Record<string, unknown>
    parentId?: string
    triggerText?: React.ReactNode
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AccountForm({
    onSuccess,
    accounts = [],
    initialData,
    parentId,
    triggerText = "Nueva Cuenta",
    triggerVariant = "default",
    open: openProp,
    onOpenChange,
    auditSidebar
}: AccountFormProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = openProp !== undefined ? openProp : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    const { createAccount, updateAccount, isCreating, isUpdating } = useAccounts()
    const loading = isCreating || isUpdating

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            code: initialData?.code as string || "",
            name: initialData?.name as string || "",
            account_type: (initialData?.account_type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE") || "ASSET",
            parent: initialData?.parent as string || parentId || undefined,
        },
    })

    const accountType = form.watch("account_type");

    // Reset form when opening or initialData changes
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    code: initialData.code as string,
                    name: initialData.name as string,
                    account_type: initialData.account_type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
                    parent: initialData.parent || undefined,
                })
            } else {
                form.reset({
                    code: "",
                    name: "",
                    account_type: "ASSET",
                    parent: undefined,
                })
            }
        }
    }, [open, initialData, form])

    // Effect to handle parent changes: Update account_type and suggest categories
    const watchParentId = form.watch("parent")
    useEffect(() => {
        if (!watchParentId || watchParentId === "__none__" || watchParentId === "none") return;
        
        const parent = accounts.find((a: any) => a.id.toString() === watchParentId.toString());
        if (parent) {
            // Force account_type to match parent
            form.setValue("account_type", (parent as any).account_type);
        }
    }, [watchParentId, accounts, form])


    async function onSubmit(data: AccountFormValues) {
        try {
            const payload: AccountPayload = {
                code: data.code || "",
                name: data.name,
                account_type: data.account_type,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? Number(data.parent) : null,
            };

            if (initialData?.id) {
                await updateAccount({ id: initialData.id as number, payload })
            } else {
                await createAccount(payload)
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
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        <span>{initialData ? "Ficha de Cuenta" : "Nueva Cuenta Contable"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {(initialData as any)?.code && (
                            <>
                                <span>{(initialData as any).code}</span>
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
                        <ActionSlideButton type="submit" form="account-form" disabled={loading}>
                            {loading ? (initialData ? "Guardando..." : "Creando...") : (initialData ? "Guardar Cambios" : "Crear Cuenta")}
                        </ActionSlideButton>
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
                                                placeholder="Automático"
                                                {...field}
                                                readOnly={true}
                                                disabled={true}
                                                className={cn(FORM_STYLES.input, "bg-muted cursor-not-allowed opacity-70")}
                                            />
                                        </FormControl>
                                        <div className="text-[10px] text-muted-foreground italic px-1 pt-1">
                                            El código se genera automáticamente al guardar según la ubicación jerárquica.
                                        </div>
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
                                        <Select 
                                            onValueChange={field.onChange} 
                                            value={field.value}
                                            disabled={!!parentId && parentId !== "__none__" && parentId !== "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger className={cn(FORM_STYLES.input, !!parentId && "bg-muted/50 opacity-80")}>
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
                                        {!!parentId && parentId !== "__none__" && parentId !== "none" && (
                                            <p className="text-[10px] text-warning font-medium mt-1">Heredado de la jerarquía del padre.</p>
                                        )}
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

                             </form>
                         </Form>
                    </div>

                    {initialData?.id && (
                        <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                            {auditSidebar}
                        </div>
                    )}
                </div>
            </BaseModal>
        </>
    )
}
