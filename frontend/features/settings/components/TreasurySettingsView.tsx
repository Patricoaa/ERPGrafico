"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Banknote, ArrowLeftRight, Settings2 } from "lucide-react"
import { AutoSaveStatusBadge, FormSkeleton } from "@/components/shared"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { treasurySchema, type TreasuryFormValues } from "./TreasurySettingsView.schema"

interface TreasurySettingsViewProps {
    activeTab: string
}

const DEFAULT_VALUES: TreasuryFormValues = {
    bank_commission_account: null,
    interest_income_account: null,
    exchange_difference_account: null,
    rounding_adjustment_account: null,
    error_adjustment_account: null,
    miscellaneous_adjustment_account: null,
    pos_cash_difference_gain_account: null,
    pos_cash_difference_loss_account: null,
    pos_tip_account: null,
    pos_other_inflow_account: null,
    pos_counting_error_account: null,
    pos_system_error_account: null,
    pos_partner_withdrawal_account: null,
    pos_theft_account: null,
    pos_rounding_adjustment_account: null,
    pos_cashback_error_account: null,
    pos_other_outflow_account: null,
}

export function TreasurySettingsView({ activeTab = "conciliation" }: TreasurySettingsViewProps) {
    const [loading, setLoading] = useState(true)

    const form = useForm<TreasuryFormValues>({
        resolver: zodResolver(treasurySchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings: Partial<TreasuryFormValues> = {}

                const keys = Object.keys(treasurySchema.shape) as (keyof TreasuryFormValues)[]
                keys.forEach((key) => {
                    const val = settings[key]
                    formattedSettings[key] = (val ? val.toString() : null) as never
                })

                form.reset(formattedSettings as TreasuryFormValues)
            } catch (error: unknown) {
                const err = error as { response?: { status?: number } }
                if (err.response?.status !== 404) {
                    toast.error("Error al cargar configuración")
                }
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    const onSave = useCallback(async (data: TreasuryFormValues) => {
        await api.patch('/accounting/settings/current/', data)
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: !loading,
    })

    useUnsavedChangesGuard(status)

    if (loading) return <FormSkeleton hasTabs tabs={3} fields={4} />

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    {activeTab === "conciliation" && (
                        <div className="m-0 p-0 border-0 outline-none mt-6">
                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <ArrowLeftRight className="h-4 w-4 text-primary opacity-50" />
                                        <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Cuentas de Conciliación Bancaria</CardTitle>
                                    </div>
                                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground italic">Identificadores para ajustes automáticos en conciliación por lotes</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        <AccountField form={form} name="bank_commission_account" label="Gasto Comisiones Bancarias" accountType="EXPENSE" />
                                        <AccountField form={form} name="interest_income_account" label="Ingreso por Intereses" accountType="INCOME" />
                                        <AccountField form={form} name="exchange_difference_account" label="Diferencia de Cambio (M.E)" accountType="" />
                                        <AccountField form={form} name="rounding_adjustment_account" label="Ajuste por Redondeo / Centavos" accountType="EXPENSE" />
                                        <AccountField form={form} name="error_adjustment_account" label="Ajustes por Errores Operativos" accountType="EXPENSE" />
                                        <AccountField form={form} name="miscellaneous_adjustment_account" label="Otros Ajustes de Tesorería" accountType="EXPENSE" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === "audit" && (
                        <div className="m-0 p-0 border-0 outline-none mt-6">
                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <Banknote className="h-4 w-4 text-primary opacity-50" />
                                        <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Diferencias de Cierre de Caja (Arqueo)</CardTitle>
                                    </div>
                                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground italic">Control de discrepancias entre saldo teórico y físico en POS</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante de Caja (Ganancia)" accountType="INCOME" />
                                        <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante de Caja (Pérdida)" accountType="EXPENSE" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === "movements" && (
                        <div className="m-0 p-0 border-0 outline-none mt-6">
                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="h-4 w-4 text-primary opacity-50" />
                                        <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Cuentas para Movimientos Manuales</CardTitle>
                                    </div>
                                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground italic">Configuración de ingresos y egresos ad-hoc del módulo POS</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-6 border-b-2 border-primary/10 pb-1 w-fit tracking-tighter">Depósitos y Entradas de Efectivo</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                            <AccountField form={form} name="pos_tip_account" label="Recaudación Propinas" accountType="INCOME" />
                                            <AccountField form={form} name="pos_other_inflow_account" label="Otros Ingresos Operativos" accountType="INCOME" />
                                            <AccountField form={form} name="pos_counting_error_account" label="Ajuste Error de Conteo (Sobrante)" accountType="INCOME" />
                                            <AccountField form={form} name="pos_system_error_account" label="Ajuste Operativo (Corrección)" accountType="EXPENSE" />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-6 border-b-2 border-primary/10 pb-1 w-fit tracking-tighter">Retiros y Salidas de Efectivo</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                            <AccountField form={form} name="pos_theft_account" label="Pérdidas / Merma de Efectivo" accountType="EXPENSE" />
                                            <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo de Pago" accountType="EXPENSE" />
                                            <AccountField form={form} name="pos_cashback_error_account" label="Faltante por Vuelto Incorrecto" accountType="EXPENSE" />
                                            <AccountField form={form} name="pos_other_outflow_account" label="Egresos Varios de Caja" accountType="EXPENSE" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </form>
            </Form>
        </div>
    )
}

interface AccountFieldProps {
    form: UseFormReturn<TreasuryFormValues>
    name: Path<TreasuryFormValues>
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
