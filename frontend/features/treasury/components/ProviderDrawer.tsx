"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Building2, Settings } from "lucide-react"
import { useTerminalProviders, type PaymentTerminalProvider } from "@/features/treasury"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Form, FormField } from "@/components/ui/form"
import { Drawer, CancelButton, ActionSlideButton, LabeledInput, FormSection, FormFooter } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { toast } from "sonner"

const providerSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    provider_type: z.string().min(1, "El tipo es requerido"),
    supplier: z.string().nullable().optional(),
    receivable_account: z.string().nullable().optional(),
    commission_expense_account: z.string().nullable().optional(),
    commission_iva_account: z.string().nullable().optional(),
})

type ProviderFormValues = z.infer<typeof providerSchema>

interface ProviderDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    provider?: PaymentTerminalProvider | null
    onSuccess?: () => void
}

export function ProviderDrawer({ open, onOpenChange, provider, onSuccess }: ProviderDrawerProps) {
    const { createProvider, updateProvider } = useTerminalProviders()
    const [loading, setLoading] = useState(false)

    const form = useForm<ProviderFormValues>({
        resolver: zodResolver(providerSchema),
        defaultValues: {
            name: "",
            provider_type: "MANUAL",
            supplier: null,
            receivable_account: null,
            commission_expense_account: null,
            commission_iva_account: null,
        }
    })

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                if (provider) {
                    form.reset({
                        name: provider.name,
                        provider_type: provider.provider_type,
                        supplier: provider.supplier?.toString() || null,
                        receivable_account: provider.receivable_account?.toString() || null,
                        commission_expense_account: provider.commission_expense_account?.toString() || null,
                        commission_iva_account: provider.commission_iva_account?.toString() || null,
                    })
                } else {
                    form.reset({
                        name: "",
                        provider_type: "MANUAL",
                        supplier: null,
                        receivable_account: null,
                        commission_expense_account: null,
                        commission_iva_account: null,
                    })
                }
            })
        }
    }, [open, provider, form])

    const onSubmit = async (values: ProviderFormValues) => {
        if (!values.name) {
            toast.error("Por favor, asigne un nombre o seleccione un contacto.")
            return
        }

        setLoading(true)
        try {
            const data = {
                name: values.name,
                provider_type: values.provider_type as PaymentTerminalProvider['provider_type'],
                supplier: values.supplier ? Number(values.supplier) : undefined as any,
                receivable_account: values.receivable_account ? Number(values.receivable_account) : undefined as any,
                commission_expense_account: values.commission_expense_account ? Number(values.commission_expense_account) : undefined as any,
                commission_iva_account: values.commission_iva_account ? Number(values.commission_iva_account) : undefined as any,
                is_active: true,
            }

            if (provider) {
                await updateProvider({ id: provider.id, data: data as any })
            } else {
                await createProvider(data as any)
            }
            onSuccess?.()
            onOpenChange(false)
        } catch {
            // Error handled by hook
        } finally {
            setLoading(false)
        }
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("medium", !!provider)}
            contentClassName="p-0"
            title={provider ? "Editar Proveedor" : "Nuevo Proveedor de Pago"}
            subtitle="Configure las cuentas contables para recaudación y comisiones."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton type="submit" loading={loading} onClick={form.handleSubmit(onSubmit)}>
                                {provider ? "Guardar Cambios" : "Crear Proveedor"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <FormSection title="Información General" icon={Building2} />
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Controller
                                control={form.control}
                                name="supplier"
                                render={({ field }) => (
                                    <AdvancedContactSelector
                                        value={field.value || null}
                                        onChange={(val) => {
                                            field.onChange(val)
                                        }}
                                        onSelectContact={(contact) => {
                                            const currentName = form.getValues("name")
                                            if (!currentName) form.setValue("name", contact.name)
                                        }}
                                        label="Contacto / Entidad (Proveedor)"
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <LabeledInput
                                        label="Nombre / Alias"
                                        required
                                        {...field}
                                        placeholder="Ej: Transbank Local Primary"
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <FormSection title="Configuración Contable" icon={Settings} className="my-4" />

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Controller
                                control={form.control}
                                name="receivable_account"
                                render={({ field }) => (
                                    <AccountSelector
                                        value={field.value || null}
                                        onChange={(v) => field.onChange(v)}
                                        accountType="ASSET"
                                        label="Cuenta Puente Recaudación"
                                    />
                                )}
                            />
                        </div>
                        <Controller
                            control={form.control}
                            name="commission_expense_account"
                            render={({ field }) => (
                                <AccountSelector
                                    value={field.value || null}
                                    onChange={(v) => field.onChange(v)}
                                    accountType="EXPENSE"
                                    label="Cuenta Gasto Comisiones"
                                />
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="commission_iva_account"
                            render={({ field }) => (
                                <AccountSelector
                                    value={field.value || null}
                                    onChange={(v) => field.onChange(v)}
                                    accountType="ASSET"
                                    label="Cuenta Puente IVA de Comisiones"
                                />
                            )}
                        />
                    </div>
                </form>
            </Form>
        </Drawer>
    )
}

export default ProviderDrawer
