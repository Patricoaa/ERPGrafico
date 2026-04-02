"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
    Loader2,
    CloudCheck,
    CloudUpload,
    Banknote,
    ArrowLeftRight,
    Settings2,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { Separator } from "@/components/ui/separator"
import { LAYOUT_TOKENS } from "@/lib/styles"

const treasurySchema = z.object({
    // Reconciliation accounts
    bank_commission_account: z.string().nullable(),
    interest_income_account: z.string().nullable(),
    exchange_difference_account: z.string().nullable(),
    rounding_adjustment_account: z.string().nullable(),
    error_adjustment_account: z.string().nullable(),
    miscellaneous_adjustment_account: z.string().nullable(),
    // POS Session Difference accounts
    pos_cash_difference_gain_account: z.string().nullable(),
    pos_cash_difference_loss_account: z.string().nullable(),
    // POS Manual Movement (adjustment) accounts
    pos_tip_account: z.string().nullable(),
    pos_other_inflow_account: z.string().nullable(),
    pos_counting_error_account: z.string().nullable(),
    pos_system_error_account: z.string().nullable(),
    pos_partner_withdrawal_account: z.string().nullable(),
    pos_theft_account: z.string().nullable(),
    pos_rounding_adjustment_account: z.string().nullable(),
    pos_cashback_error_account: z.string().nullable(),
    pos_other_outflow_account: z.string().nullable(),
})

type TreasuryFormValues = z.infer<typeof treasurySchema>

export default function TreasurySettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const form = useForm<TreasuryFormValues>({
        resolver: zodResolver(treasurySchema),
        defaultValues: {
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

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: TreasuryFormValues) => {
        setSaving(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            toast.success("Configuración de tesorería aplicada")
            form.reset(data)
        } catch {
            toast.error("Error al guardar cambios")
        } finally {
            setSaving(false)
        }
    }, [form])

    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty, form, onSubmit])

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de Tesorería"
                description="Gestione las cuentas de ajuste para conciliación bancaria y movimientos de caja."
                iconName="settings"
            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                    {saving ? (
                        <>
                            <CloudUpload className="h-3 w-3 animate-pulse text-primary" />
                            <span className="text-primary">Guardando cambios...</span>
                        </>
                    ) : (
                        <>
                            <CloudCheck className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600">Cambios guardados</span>
                        </>
                    )}
                </div>
            </PageHeader>

            <Form {...form}>
                <form className="space-y-6">
                    {/* --- Reconciliation --- */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight className="h-4 w-4 text-primary" />
                                <CardTitle className="text-lg">Cuentas de Conciliación Bancaria</CardTitle>
                            </div>
                            <CardDescription>Cuentas para justificar diferencias en conciliación</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="bank_commission_account" label="Comisiones Bancarias" accountType="EXPENSE" />
                                <AccountField form={form} name="interest_income_account" label="Intereses Ganados" accountType="INCOME" />
                                <AccountField form={form} name="exchange_difference_account" label="Diferencia de Cambio" accountType="" />
                                <AccountField form={form} name="rounding_adjustment_account" label="Ajuste por Redondeo" accountType="EXPENSE" />
                                <AccountField form={form} name="error_adjustment_account" label="Ajuste por Error" accountType="EXPENSE" />
                                <AccountField form={form} name="miscellaneous_adjustment_account" label="Ajustes Varios" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* --- POS Session Differences --- */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-primary" />
                                <CardTitle className="text-lg">Diferencias de Cierre de Caja (Arqueo)</CardTitle>
                            </div>
                            <CardDescription>Cuentas para el ajuste automático al cierre de sesión POS cuando hay diferencia entre el monto esperado y el contado</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante de Caja (Ganancia)" accountType="INCOME" />
                                <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante de Caja (Pérdida)" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* --- POS Manual Movements --- */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Settings2 className="h-4 w-4 text-primary" />
                                <CardTitle className="text-lg">Cuentas para Movimientos Manuales de Caja</CardTitle>
                            </div>
                            <CardDescription>Cuentas contables usadas en depósitos, retiros y ajustes manuales del POS y Tesorería</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-4">Ingresos / Depósitos</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="pos_tip_account" label="Propinas" accountType="INCOME" />
                                    <AccountField form={form} name="pos_other_inflow_account" label="Otros Ingresos (Varios)" accountType="INCOME" />
                                    <AccountField form={form} name="pos_counting_error_account" label="Error de Conteo (Sobrante)" accountType="INCOME" />
                                    <AccountField form={form} name="pos_system_error_account" label="Error de Sistema (Ajuste)" accountType="EXPENSE" />
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-4">Egresos / Retiros</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="pos_theft_account" label="Robo / Pérdida" accountType="EXPENSE" />
                                    <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo" accountType="EXPENSE" />
                                    <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo" accountType="EXPENSE" />
                                    <AccountField form={form} name="pos_cashback_error_account" label="Vuelto Incorrecto" accountType="EXPENSE" />
                                    <AccountField form={form} name="pos_other_outflow_account" label="Otros Egresos (Varios)" accountType="EXPENSE" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
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
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">{label}</FormLabel>
                    <FormControl>
                        <AccountSelector
                            value={field.value as string}
                            onChange={(val) => field.onChange(val)}
                            accountType={accountType}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}


