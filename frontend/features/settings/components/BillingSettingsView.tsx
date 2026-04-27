"use client"

import React, { useEffect, useCallback, useState } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useBillingSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

import { Separator } from "@/components/ui/separator"
import {
    Percent,
    Receipt,
    Coins,
    TrendingUp,
    Check,

} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { LabeledInput } from "@/components/shared"

import { billingSchema, type BillingFormValues } from "./BillingSettingsView.schema"

export const BillingSettingsView: React.FC<{
    activeTab?: string,
    onSavingChange?: (saving: boolean) => void
}> = ({ activeTab = "accounts", onSavingChange }) => {
    const [currentTab, setCurrentTab] = useState(activeTab)
    const { settings, saving, updateSettings } = useBillingSettings()

    const form = useForm<BillingFormValues>({
        // ... (existing form config)
        resolver: zodResolver(billingSchema),
        defaultValues: {
            default_receivable_account: null,
            default_payable_account: null,
            default_advance_payment_account: null,
            default_prepayment_account: null,
            allowed_dte_types_emit: [],
            allowed_dte_types_receive: [],
        }
    })

    // Update saving status to parent
    useEffect(() => {
        onSavingChange?.(saving)
    }, [saving, onSavingChange])

    const watchedValues = form.watch()
    const { isDirty, errors } = form.formState

    const onSubmit = useCallback(async (data: BillingFormValues) => {
        try {
            await updateSettings(data)
            form.reset(data)
        } catch {
            // Error already handled by hook
        }
    }, [updateSettings, form])

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            const formattedSettings: Partial<BillingFormValues> = {}
            const keys = Object.keys(billingSchema.shape) as (keyof BillingFormValues)[]

            keys.forEach((key) => {
                const val = settings[key]
                if (val === null || val === undefined) {
                    if (key === 'default_vat_rate') {
                        (formattedSettings as Record<string, unknown>)[key] = 19.00;
                    } else if (key === 'allowed_dte_types_emit' || key === 'allowed_dte_types_receive') {
                        (formattedSettings as Record<string, unknown>)[key] = [];
                    } else {
                        (formattedSettings as Record<string, unknown>)[key] = null;
                    }
                } else if (key === 'default_vat_rate') {
                    (formattedSettings as Record<string, unknown>)[key] = parseFloat(val.toString())
                } else {
                    (formattedSettings as Record<string, unknown>)[key] = val
                }
            })

            form.reset(formattedSettings as BillingFormValues)
        }
    }, [settings, form])

    useEffect(() => {
        if (isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, isDirty, form, onSubmit])

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <Form {...form}>
                <form className="mt-6 space-y-6">
                    {activeTab === "accounts" && (
                        <div className="space-y-6 m-0 p-0 border-0 outline-none mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg text-primary">Cuentas por Cobrar</CardTitle>
                                        <CardDescription>Gestión de clientes y anticipos recibidos</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_receivable_account" label="CxC Clientes (Activo)" accountType="ASSET" />
                                        <AccountField form={form} name="default_advance_payment_account" label="Anticipos de Clientes (Pasivo)" accountType="LIABILITY" />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg text-primary">Cuentas por Pagar</CardTitle>
                                        <CardDescription>Gestión de proveedores y anticipos entregados</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_payable_account" label="CxP Proveedores (Pasivo)" accountType="LIABILITY" />
                                        <AccountField form={form} name="default_prepayment_account" label="Anticipos a Proveedores (Activo)" accountType="ASSET" />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === "dtes" && (
                        <div className="space-y-6 m-0 p-0 border-0 outline-none mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <DTEConfigCard
                                    form={form}
                                    name="allowed_dte_types_emit"
                                    title="Documentos a Emitir (Ventas/POS)"
                                    description="Seleccione qué tipos de documentos están habilitados para ser emitidos."
                                />
                                <DTEConfigCard
                                    form={form}
                                    name="allowed_dte_types_receive"
                                    title="Documentos a Recibir (Compras)"
                                    description="Seleccione qué tipos de documentos están habilitados para ser registrados."
                                />
                            </div>
                        </div>
                    )}
                </form>
            </Form>
        </div>
    )
}


export default BillingSettingsView

interface AccountFieldProps {
    form: UseFormReturn<BillingFormValues>
    name: Path<BillingFormValues>
    label: string
    accountType: string
}

function AccountField({ form, name, label, accountType }: AccountFieldProps) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <AccountSelector
                    label={label}
                    value={field.value as string}
                    onChange={(val) => field.onChange(val)}
                    accountType={accountType}
                    error={fieldState.error?.message}
                />
            )}
        />
    )
}

interface DTEConfigCardProps {
    form: UseFormReturn<BillingFormValues>
    name: "allowed_dte_types_emit" | "allowed_dte_types_receive"
    title: string
    description: string
}

function DTEConfigCard({ form, name, title, description }: DTEConfigCardProps) {
    const dteTypes = [
        { id: 'FACTURA', label: 'Factura Electrónica', code: '33' },
        { id: 'FACTURA_EXENTA', label: 'Factura Exenta', code: '34' },
        { id: 'BOLETA', label: 'Boleta Electrónica', code: '39' },
        { id: 'BOLETA_EXENTA', label: 'Boleta Exenta', code: '41' },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                        <FormItem>
                            <div className="grid grid-cols-1 gap-4">
                                {dteTypes.map((type) => (
                                    <div key={type.id} className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => {
                                        const current = (field.value as string[]) || [];
                                        const next = current.includes(type.id)
                                            ? current.filter((v) => v !== type.id)
                                            : [...current, type.id];
                                        field.onChange(next);
                                    }}>
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${((field.value as string[]) || []).includes(type.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                            {((field.value as string[]) || []).includes(type.id) && <Check className="h-3.5 w-3.5 text-primary-foreground stroke-[4]" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold leading-none">{type.label}</div>
                                            <div className="text-[10px] text-muted-foreground mt-1">Código SII: {type.code}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
