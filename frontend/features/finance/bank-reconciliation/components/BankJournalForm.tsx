"use client"

import { showApiError } from "@/lib/errors"
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
import {
    Select,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { FORM_STYLES } from "@/lib/styles"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { WalletCards } from "lucide-react"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput, LabeledSelect } from "@/components/shared"

const journalSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    currency: z.string().min(1, "La moneda es requerida"),
    account: z.string().min(1, "La cuenta contable es requerida"),
})

type JournalFormValues = z.infer<typeof journalSchema>

interface BankJournalFormProps {
    auditSidebar?: React.ReactNode
    onSuccess?: () => void
    initialData?: Record<string, unknown> | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function BankJournalForm({ auditSidebar,  onSuccess, initialData, open: openProp, onOpenChange }: BankJournalFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(journalSchema),
        defaultValues: initialData ? {
            ...initialData,
            account: initialData.account?.toString() || "",
        } : {
            name: "",
            code: "",
            currency: "CLP",
        },
    })



    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    account: (initialData.account as { id?: number } | undefined)?.id?.toString() || initialData.account?.toString() || "",
                })
            } else {
                form.reset({
                    name: "",
                    code: "",
                    currency: "CLP",
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: JournalFormValues) {
        setLoading(true)
        try {
            if (initialData && initialData.id) {
                await api.put(`/treasury/journals/${initialData.id}/`, data)
            } else {
                await api.post('/treasury/journals/', data)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            console.error("Error saving journal:", error)
            showApiError(error, "Error al guardar la caja/banco")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={setOpen}
            size={initialData ? "lg" : "md"}
            title={
                <div className="flex items-center gap-3">
                    <WalletCards className="h-5 w-5 text-muted-foreground" />
                    <span>{initialData ? "Ficha de Caja/Banco" : "Crear Caja o Banco"}</span>
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
                    <span>{form.watch("name") || "Nueva Cuenta de Tesorería"}</span>
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
                    <ActionSlideButton type="submit" form="bank-journal-form" disabled={loading}>
                        {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Caja/Banco"}
                    </ActionSlideButton>
                </div>
            }
        >
            <div className="flex-1 flex overflow-hidden min-h-[400px]">
                <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                    <Form {...form}>
                        <form id="bank-journal-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4 pl-1 pb-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Nombre"
                                placeholder="Banco Estado Cta Cte"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Código"
                                    placeholder="BEST-CTE"
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="currency"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Moneda"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                    options={[
                                        { value: "CLP", label: "CLP (Peso Chileno)" },
                                        { value: "USD", label: "USD (Dólar)" },
                                        { value: "EUR", label: "EUR (Euro)" }
                                    ]}
                                    placeholder="Seleccione moneda"
                                />
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="account"
                        render={({ field, fieldState }) => (
                            <AccountSelector
                                value={field.value}
                                onChange={field.onChange}
                                accountType="ASSET"
                                isReconcilable={true}
                                placeholder="Seleccionar cuenta de banco/caja"
                                label="Cuenta Contable"
                                error={fieldState.error?.message}
                            />
                        )}
                    />
                    </form>
                </Form>
                </div>

                {(initialData as any)?.id && (
                    <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                        {auditSidebar}
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
