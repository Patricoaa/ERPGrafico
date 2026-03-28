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
})

type PartnerAccountingValues = z.infer<typeof partnerAccountingSchema>

export function PartnerAccountingTab() {
    const { settings, saving, updateSettings } = usePartnerSettings()

    const form = useForm<PartnerAccountingValues>({
        resolver: zodResolver(partnerAccountingSchema),
        defaultValues: {
            partner_capital_social_account: null,
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
                partner_capital_social_account: settings.partner_capital_social_account
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
                    <h3 className="text-lg font-bold tracking-tight">Cuentas de Enlace</h3>
                    <p className="text-xs text-muted-foreground italic">
                        Configure cómo el sistema genera asientos contables de capital social.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                    {saving ? (
                        <>
                            <CloudUpload className="h-3 w-3 animate-pulse text-blue-500" />
                            <span className="text-blue-600">Guardando cambios...</span>
                        </>
                    ) : (
                        <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600">Cambios guardados</span>
                        </>
                    )}
                </div>
            </div>

            <IndustrialCard variant="industrial">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Control de Capital</CardTitle>
                            <CardDescription>Defina la cuenta de patrimonio para el capital social comprometido.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Form {...form}>
                        <form className="space-y-4">
                            <FormField
                                control={form.control}
                                name="partner_capital_social_account"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                                            Cuenta de Capital Social (Patrimonio)
                                        </FormLabel>
                                        <FormControl>
                                            <AccountSelector
                                                value={field.value as string}
                                                onChange={(val) => field.onChange(val)}
                                                accountType="EQUITY"
                                                placeholder="Seleccione la cuenta de capital social..."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 flex gap-3">
                                            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-blue-700 leading-relaxed italic">
                                                Esta cuenta recibirá los abonos por suscripción de capital y los cargos por reducción de capital. 
                                                Es la cuenta principal que refleja el patrimonio legal de la empresa.
                                            </p>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </CardContent>
            </IndustrialCard>
        </div>
    )
}
