"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Building2, Settings, Printer } from "lucide-react"
import { useTerminalProviders, type PaymentTerminalProvider, type PaymentTerminalProviderCreatePayload, type PaymentTerminalProviderUpdatePayload } from "@/features/treasury"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { Drawer, CancelButton, ActionSlideButton, LabeledInput, FormSection, FormFooter, FormSplitLayout } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { toast } from "sonner"

const providerSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    provider_type: z.string().min(1, "El tipo es requerido"),
    supplier: z.string().nullable().optional(),
    receivable_account: z.string().nullable().optional(),
    commission_expense_account: z.string().nullable().optional(),
    commission_iva_account: z.string().nullable().optional(),
    commission_product: z.string().nullable().optional(),
    default_deposit_account: z.string().nullable().optional(),
})

type ProviderFormValues = z.infer<typeof providerSchema>

interface ProviderDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    provider?: PaymentTerminalProvider | null
    onSuccess?: () => void
    mode?: DrawerMode
}

export function ProviderDrawer({ open, onOpenChange, provider, onSuccess, mode: modeProp }: ProviderDrawerProps) {
    const { createProvider, updateProvider } = useTerminalProviders()
    const mode: DrawerMode = modeProp ?? (provider ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })
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
            commission_product: null,
            default_deposit_account: null,
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
                        commission_product: provider.commission_product?.toString() || null,
                        default_deposit_account: provider.default_deposit_account?.toString() || null,
                    })
                } else {
                    form.reset({
                        name: "",
                        provider_type: "MANUAL",
                        supplier: null,
                        receivable_account: null,
                        commission_expense_account: null,
                        commission_iva_account: null,
                        commission_product: null,
                        default_deposit_account: null,
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
                supplier: values.supplier ? Number(values.supplier) : undefined,
                receivable_account: values.receivable_account ? Number(values.receivable_account) : undefined,
                commission_expense_account: values.commission_expense_account ? Number(values.commission_expense_account) : undefined,
                commission_iva_account: values.commission_iva_account ? Number(values.commission_iva_account) : undefined,
                commission_product: values.commission_product ? Number(values.commission_product) : undefined,
                default_deposit_account: values.default_deposit_account ? Number(values.default_deposit_account) : null,
                is_active: true,
            }

            if (provider) {
                await updateProvider({ id: provider.id, data: data as unknown as PaymentTerminalProviderUpdatePayload })
            } else {
                await createProvider(data as unknown as PaymentTerminalProviderCreatePayload)
            }
            onSuccess?.()
            onOpenChange(false)
        } catch {
            // Error handled by hook
        } finally {
            setLoading(false)
        }
    }

    const drawerTitle = isView
        ? `Ficha de Proveedor${provider?.id ? ` #${provider.id}` : ""}`
        : mode === 'create'
            ? "Nuevo Proveedor de Pago"
            : "Editar Proveedor"

    return (
        <>
            {(mode === 'view' || mode === 'edit') && provider?.id && (
                <PrintableLayout ref={printRef} title="Proveedor" displayId={`#${provider.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{provider?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cta. Destino Liquidación:</span>
                            <span>{provider?.bank_treasury_account_name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("medium", !!provider)}
                mode={mode}
                title={<span>{drawerTitle}</span>}
                headerActions={(mode === 'view' || mode === 'edit') && provider?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle="Configure las cuentas contables para recaudación y comisiones."
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <ActionSlideButton type="submit" loading={loading} onClick={form.handleSubmit(onSubmit)}>
                                    {mode === 'create' ? "Crear Proveedor" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <Form {...form}>
                    <FormSplitLayout>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
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
                                    <Controller
                                        control={form.control}
                                        name="commission_product"
                                        render={({ field }) => (
                                            <ProductSelector
                                                value={field.value || null}
                                                onChange={(v) => field.onChange(v)}
                                                label="Producto Servicio Comisión"
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="default_deposit_account"
                                        render={({ field }) => (
                                            <TreasuryAccountSelector
                                                value={field.value || null}
                                                onChange={(v) => field.onChange(v)}
                                                accountTypes={['CHECKING', 'CASH']}
                                                label="Cuenta de Tesorería por Defecto (Depósito)"
                                            />
                                        )}
                                    />
                                </div>
                            </fieldset>
                        </form>
                    </FormSplitLayout>
                </Form>
            </Drawer>
        </>
    )
}

export default ProviderDrawer
