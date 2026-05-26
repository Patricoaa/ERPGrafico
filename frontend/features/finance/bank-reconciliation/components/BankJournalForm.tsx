"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { financeApi } from "../../api/financeApi"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { WalletCards } from "lucide-react"
import { Drawer, LabeledInput, LabeledSelect, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"

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
                await financeApi.updateJournal(initialData.id as number, data)
            } else {
                await financeApi.createJournal(data)
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
        <Drawer
            open={open}
            onOpenChange={setOpen}
            side="left"
            defaultSize={initialData ? "55%" : "50%"}
            icon={WalletCards}
            title={initialData ? "Ficha de Caja/Banco" : "Crear Caja o Banco"}
            subtitle={initialData ? `${(initialData as any).code || ""} • ${form.watch("name") || ""}` : "Tesorería • Configuración de Caja o Banco"}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => setOpen(false)} />
                            <ActionSlideButton type="submit" form="bank-journal-form" loading={loading}>
                                {initialData ? "Guardar Cambios" : "Crear Caja/Banco"}
                            </ActionSlideButton>
                        </>
                    }
                />
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
        </Drawer>
    )
}
