"use client"

import React, { useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { usePartnerSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { 
    Building2, 
    Check, 
    CloudUpload,
    Info
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { IndustrialCard } from "@/components/shared/IndustrialCard"

const partnerAccountingSchema = z.object({
    partner_capital_social_account: z.union([z.string(), z.number()]).nullable(),
    partner_capital_receivable_account: z.union([z.string(), z.number()]).nullable(),
    partner_dividends_payable_account: z.union([z.string(), z.number()]).nullable(),
    partner_retained_earnings_account: z.union([z.string(), z.number()]).nullable(),
    partner_current_year_earnings_account: z.union([z.string(), z.number()]).nullable(),
})

type PartnerAccountingValues = z.infer<typeof partnerAccountingSchema>

export function PartnerAccountingTab() {
    const { settings, saving, updateSettings } = usePartnerSettings()

    const form = useForm<PartnerAccountingValues>({
        resolver: zodResolver(partnerAccountingSchema),
        defaultValues: {
            partner_capital_social_account: null,
            partner_capital_receivable_account: null,
            partner_dividends_payable_account: null,
            partner_retained_earnings_account: null,
            partner_current_year_earnings_account: null,
        }
    })

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: PartnerAccountingValues) => {
        try {
            await updateSettings(data)
            form.reset(data)
        } catch (error) {
            console.error(error)
        }
    }, [updateSettings, form])

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            form.reset({
                partner_capital_social_account: settings.partner_capital_social_account,
                partner_capital_receivable_account: settings.partner_capital_receivable_account,
                partner_dividends_payable_account: settings.partner_dividends_payable_account,
                partner_retained_earnings_account: settings.partner_retained_earnings_account,
                partner_current_year_earnings_account: settings.partner_current_year_earnings_account,
            })
        }
    }, [settings, form])

    // Auto-save logic
    useEffect(() => {
        if (isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, isDirty, form, onSubmit])

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between pb-2 border-b">
                <div className="space-y-0.5">
                    <h3 className="text-lg font-bold tracking-tight">Arquitectura Contable de Socios</h3>
                    <p className="text-xs text-muted-foreground italic">
                        Configure las cuentas maestras para el Modelo Híbrido de Capital.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                    {saving ? (
                        <>
                            <CloudUpload className="h-3 w-3 animate-pulse text-blue-500" />
                            <span className="text-blue-600">Sincronizando...</span>
                        </>
                    ) : (
                        <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600">Configuración validada</span>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Patrimonio Row */}
                <IndustrialCard variant="industrial" className="md:col-span-2">
                    <CardHeader className="pb-4 border-b bg-muted/20">
                        <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-widest">Cuentas Maestras de Patrimonio (Capital y Utilidades)</CardTitle>
                                <CardDescription className="text-[10px]">Define las cuentas raíz para la consolidación patrimonial.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <FormField
                                    control={form.control}
                                    name="partner_capital_social_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Cuenta Raíz de Capital Social</FormLabel>
                                            <FormControl>
                                                <AccountSelector
                                                    value={field.value as string}
                                                    onChange={(val) => field.onChange(val)}
                                                    accountType="EQUITY"
                                                    placeholder="3.1.0X Capital Social..."
                                                />
                                            </FormControl>
                                            <p className="text-[9px] text-muted-foreground italic mt-1">Se usará como nodo padre para las sub-cuentas individuales de socios.</p>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="partner_retained_earnings_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Utilidades Retenidas (Consolidada)</FormLabel>
                                            <FormControl>
                                                <AccountSelector
                                                    value={field.value as string}
                                                    onChange={(val) => field.onChange(val)}
                                                    accountType="EQUITY"
                                                    placeholder="3.2.0X Utilidades Retenidas..."
                                                />
                                            </FormControl>
                                            <p className="text-[9px] text-muted-foreground italic mt-1">Cuenta de patrimonio donde se acumulan las utilidades no distribuidas.</p>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="partner_current_year_earnings_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Utilidad del Ejercicio Actual</FormLabel>
                                            <FormControl>
                                                <AccountSelector
                                                    value={field.value as string}
                                                    onChange={(val) => field.onChange(val)}
                                                    accountType="EQUITY"
                                                    placeholder="3.4.0X Resultado del Ejercicio..."
                                                />
                                            </FormControl>
                                            <p className="text-[9px] text-muted-foreground italic mt-1">Cuenta puente que recibe el resultado neto antes de la distribución.</p>
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>
                    </CardContent>
                </IndustrialCard>

                {/* 2. Operativas Row */}
                <IndustrialCard variant="industrial" className="md:col-span-2">
                    <CardHeader className="pb-4 border-b bg-muted/20">
                        <div className="flex items-center gap-3">
                            <Info className="h-5 w-5 text-blue-500" />
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-widest">Cuentas Operativas (Pasivo y Activo)</CardTitle>
                                <CardDescription className="text-[10px]">Configura las cuentas para dividendos pendientes y capital por cobrar.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <FormField
                                    control={form.control}
                                    name="partner_dividends_payable_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dividendos por Pagar (Pasivo)</FormLabel>
                                            <FormControl>
                                                <AccountSelector
                                                    value={field.value as string}
                                                    onChange={(val) => field.onChange(val)}
                                                    accountType="LIABILITY"
                                                    placeholder="2.1.0X Dividendos por Pagar..."
                                                />
                                            </FormControl>
                                            <p className="text-[9px] text-muted-foreground italic mt-1">Obligación con socios por utilidades ya asignadas pero no pagadas.</p>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="partner_capital_receivable_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Capital por Cobrar (Activo)</FormLabel>
                                            <FormControl>
                                                <AccountSelector
                                                    value={field.value as string}
                                                    onChange={(val) => field.onChange(val)}
                                                    accountType="ASSET"
                                                    placeholder="1.1.0X Capital por Cobrar..."
                                                />
                                            </FormControl>
                                            <p className="text-[9px] text-muted-foreground italic mt-1">Cuenta de activo que refleja el capital suscrito pendiente de ingreso.</p>
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>
                    </CardContent>
                </IndustrialCard>
            </div>
            
            {/* Health Check Alert */}
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase text-emerald-800">Verificador de Integridad Societaria</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                    El sistema ha validado que el modelo de datos de socios es coherente. Todas las suscripciones de capital se mapearán automáticamente a las cuentas individuales bajo el nodo maestro seleccionado. 
                    <strong className="ml-1">Nota:</strong> Si cambia una cuenta maestra, el sistema no moverá los saldos históricos automáticamente; deberá realizar un traspaso manual vía Diario.
                </p>
            </div>
        </div>
    )
}
