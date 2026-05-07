"use client"

import { useCallback } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, FormSkeleton } from "@/components/shared"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { purchasingSchema, type PurchasingFormValues } from "./PurchasingSettingsView.schema"

import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"

export function PurchasingSettingsView() {
    const { purchasing: settings } = useAccountingSettings()

    const form = useForm<PurchasingFormValues>({
        resolver: zodResolver(purchasingSchema),
        defaultValues: settings,
    })

    const onSave = useCallback(async (data: PurchasingFormValues) => {
        await api.patch('/accounting/settings/current/', data)
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

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
                    <Card className="rounded-md border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Cuentas de Gastos Predeterminadas</CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground italic">Configuración de contrapartidas contables para compras y gastos operativos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <AccountField form={form} name="default_expense_account" label="Cuenta Gastos Generales (Insumos/Stock)" accountType="EXPENSE" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <AccountField form={form} name="default_service_expense_account" label="Gastos por Servicios Externos" accountType="EXPENSE" />
                                <AccountField form={form} name="default_subscription_expense_account" label="Gastos por Suscripciones Digitales" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

function AccountField({ form, name, label, accountType }: { form: UseFormReturn<PurchasingFormValues>, name: Path<PurchasingFormValues>, label: string, accountType: string }) {
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
