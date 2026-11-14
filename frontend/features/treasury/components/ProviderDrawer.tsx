"use client"

import { useState } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, KeyRound, Settings } from "lucide-react"
import { useTerminalProviders, type PaymentTerminalProvider, type PaymentTerminalProviderCreatePayload, type PaymentTerminalProviderUpdatePayload } from "@/features/treasury"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Form, FormField } from "@/components/ui/form"
import { useDrawerIdentity, useDrawerMode, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { Drawer, CancelButton, SubmitButton, LabeledInput, FormFooter, FormSplitLayout, Section } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { toast } from "sonner"
import { providerSchema, type ProviderFormValues } from "./providerDrawerSchema"

interface ProviderDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    provider?: PaymentTerminalProvider | null
    onSuccess?: () => void
    mode?: DrawerMode
}

export function ProviderDrawer({ open, onOpenChange, provider, onSuccess, mode: modeProp }: ProviderDrawerProps) {
    const { createProvider, updateProvider } = useTerminalProviders()
    const { mode, isView } = useDrawerMode({ mode: modeProp, initialData: provider })
    const { printRef, handlePrint } = usePrintableDrawer()
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
            api_key: "",
        }
    })

    const isTuu = form.watch("provider_type") === "TUU"

    useInitializeDrawerForm({
        form,
        open,
        initialData: provider,
        defaultValues: () => ({
            name: "",
            provider_type: "MANUAL",
            supplier: null,
            receivable_account: null,
            commission_expense_account: null,
            commission_iva_account: null,
            commission_product: null,
            default_deposit_account: null,
            api_key: "",
        }),
        mapData: (data) => ({
            name: data.name,
            provider_type: data.provider_type,
            supplier: data.supplier?.toString() || null,
            receivable_account: data.receivable_account?.toString() || null,
            commission_expense_account: data.commission_expense_account?.toString() || null,
            commission_iva_account: data.commission_iva_account?.toString() || null,
            commission_product: data.commission_product?.toString() || null,
            default_deposit_account: data.default_deposit_account?.toString() || null,
            api_key: "",
        }),
    })

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
                ...(values.api_key?.trim() ? { api_key: values.api_key.trim() } : {}),
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

    const overrideTitle = isView
        ? `Ficha de Proveedor${provider?.id ? ` #${provider.id}` : ""}`
        : mode === 'edit'
            ? "Editar Proveedor"
            : undefined
    const identity = useDrawerIdentity('treasury.terminalprovider', mode, provider, {
        overrideTitle,
        overrideSubtitle: "Configure las cuentas contables para recaudación y comisiones.",
        printable: (mode === 'view' || mode === 'edit') && !!provider?.id,
        onPrint: handlePrint,
    })

    return (
        <>
            {(mode === 'view' || mode === 'edit') && provider?.id && (
                <PrintableLayout ref={printRef} title="Proveedor" displayId={`#${provider.id}`}>
                    <div className="text-4xs space-y-1 mb-2">
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
                fillContent
                contentClassName="p-0"
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("medium", !!provider)}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <SubmitButton type="submit" loading={loading} onClick={form.handleSubmit(onSubmit)}>
                                    {mode === 'create' ? "Crear Proveedor" : "Guardar Cambios"}
                                </SubmitButton>
                            </>
                        }
                    />
                )}
            >
                <Form {...form}>
                    <FormSplitLayout className="space-y-6 p-6">
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <fieldset disabled={isView} className="contents">
                                <Section.Header spaced title="Información General" icon={Building2} />
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

                                {isTuu && (
                                    <>
                                        <Section.Header spaced title="Integración TUU" icon={KeyRound} className="my-4" />
                                        <FormField
                                            control={form.control}
                                            name="api_key"
                                            render={({ field }) => (
                                                <LabeledInput
                                                    label="API key"
                                                    type="password"
                                                    autoComplete="off"
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    placeholder={provider?.has_api_key ? "Configurada" : "Pegue la API key de TUU"}
                                                    hint="Se guarda cifrada. Déjela vacía para mantener la actual."
                                                />
                                            )}
                                        />
                                    </>
                                )}

                                <Section.Header spaced title="Configuración Contable" icon={Settings} className="my-4" />

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
                                                productTypes={['SERVICE']}
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
