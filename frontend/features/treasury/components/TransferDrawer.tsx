"use client"

import React, { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { showApiError } from "@/lib/errors"
import { ArrowLeftRight, DollarSign } from "lucide-react"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"
import { TreasuryAccountSelector } from "@/components/selectors"
import { PeriodValidationDateInput } from "@/components/shared"
import { useServerDate } from "@/hooks/useServerDate"
import { useTreasuryAccounts } from "@/features/treasury/hooks/useTreasuryAccounts"
import { useTransfer } from "@/features/treasury/hooks/useTransfer"
import { Form, FormField } from "@/components/ui/form"
import { CancelButton, LabeledInput, FormSection, FormFooter, FormSplitLayout, ActionSlideButton, Drawer, MoneyDisplay, SkeletonShell } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"

const transferSchema = z.object({
    from_account_id: z.string().min(1, "Seleccione una cuenta de origen"),
    to_account_id: z.string().min(1, "Seleccione una cuenta de destino"),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "El monto debe ser mayor a 0"),
    date: z.date({ message: "La fecha es requerida" }),
    notes: z.string().optional(),
}).refine((data) => data.from_account_id !== data.to_account_id, {
    message: "La cuenta de origen y destino no pueden ser la misma",
    path: ["to_account_id"]
})

type TransferFormValues = z.infer<typeof transferSchema>

interface TransferDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    mode?: DrawerMode
}

export function TransferDrawer({ open, onOpenChange, onSuccess, mode: modeProp }: TransferDrawerProps) {
    const { accounts, isLoading: isAccountsLoading } = useTreasuryAccounts()
    const { createTransfer, isCreating } = useTransfer()
    const { serverDate, isLoading: isServerDateLoading } = useServerDate()
    const mode: DrawerMode = modeProp ?? 'create'
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const isFetchingInitialData = open && (isAccountsLoading || isServerDateLoading)
    const [isDateValid, setIsDateValid] = useState(true)

    const form = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: {
            from_account_id: "",
            to_account_id: "",
            amount: "",
            notes: "",
        }
    })

    const fromAccountId = form.watch("from_account_id")
    const toAccountId = form.watch("to_account_id")
    const amount = form.watch("amount")

    useEffect(() => {
        if (serverDate && !form.getValues("date")) {
            form.setValue("date", serverDate)
        }
    }, [serverDate, form])

    const onSubmit = async (values: TransferFormValues) => {
        try {
            await createTransfer({
                from_account_id: values.from_account_id,
                to_account_id: values.to_account_id,
                amount: parseFloat(values.amount),
                notes: values.notes,
                date: values.date.toISOString().split('T')[0] + 'T' + new Date().toTimeString().split(' ')[0],
            })
            onOpenChange(false)
            onSuccess?.()
            form.reset()
        } catch (error: unknown) {
            showApiError(error, "Error al realizar traspaso")
        }
    }

    const sourceAccount = accounts.find(a => a.id.toString() === fromAccountId)

    const identity = useDrawerIdentity('treasury.transfer', mode, undefined, {
        customTitle: isView ? "Ficha de Traspaso" : "Traspaso entre Cuentas",
        subtitle: "Mueva fondos entre sus cuentas de tesorería de forma inmediata.",
    })

    return (
        <>
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("medium", false)}
                mode={mode}
                title={identity.title}
                icon={identity.icon}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} disabled={isCreating} />
                                <ActionSlideButton
                                    loading={isCreating}
                                    onClick={form.handleSubmit(onSubmit)}
                                    disabled={isCreating || !isDateValid}
                                    className="bg-warning hover:bg-warning/90 shadow-warning/10"
                                >
                                    Confirmar Traspaso
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de traspaso">
                    <FormSplitLayout>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                <fieldset disabled={isView} className="contents">
                                    {/* Section 1: Accounts */}
                                    <div className="space-y-4">
                                        <FormSection title="Flujo de Fondos" icon={ArrowLeftRight} />
                                        <FormField
                                            control={form.control}
                                            name="from_account_id"
                                            render={({ field, fieldState }) => (
                                                <div className="relative">
                                                    <TreasuryAccountSelector
                                                        label="Cuenta Origen"
                                                        required
                                                        value={field.value}
                                                        onChange={(v) => field.onChange(v ?? "")}
                                                        excludeId={toAccountId ? Number(toAccountId) : undefined}
                                                        error={fieldState.error?.message}
                                                    />
                                                    {sourceAccount && (
                                                        <div className="absolute -bottom-5 right-1 px-1.5 py-0.5 rounded bg-muted/30 border border-muted/50">
                                                            <p className="text-[10px] font-mono leading-none">
                                                                DISP: <span className="font-bold text-success"><MoneyDisplay amount={sourceAccount.current_balance} /></span>
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="to_account_id"
                                            render={({ field, fieldState }) => (
                                                <TreasuryAccountSelector
                                                    label="Cuenta Destino"
                                                    required
                                                    value={field.value}
                                                    onChange={(v) => field.onChange(v ?? "")}
                                                    excludeId={fromAccountId ? Number(fromAccountId) : undefined}
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />
                                    </div>

                                    {/* Section 2: Transaction Details */}
                                    <div className="space-y-4">
                                        <FormSection title="Detalles de la Transacción" icon={DollarSign} />
                                        <FormField
                                            control={form.control}
                                            name="amount"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Monto a Traspasar"
                                                    type="number"
                                                    icon={<DollarSign className="h-4 w-4 opacity-40" />}
                                                    placeholder="0"
                                                    className="text-lg font-black tracking-tight"
                                                    required
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="date"
                                            render={({ field }) => (
                                                <PeriodValidationDateInput
                                                    date={field.value}
                                                    onDateChange={field.onChange}
                                                    label="Fecha Efectiva"
                                                    validationType="accounting"
                                                    onValidityChange={setIsDateValid}
                                                    required
                                                />
                                            )}
                                        />
                                        {sourceAccount && toAccountId && amount && !isNaN(parseFloat(amount)) && (
                                            <div className="p-2.5 rounded-md bg-warning/5 border border-warning/20 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
                                                <p className="text-[10px] text-warning font-black uppercase tracking-widest mb-1">Impacto en Origen</p>
                                                <p className="text-xs font-black text-warning">
                                                    <MoneyDisplay amount={(sourceAccount.current_balance ?? 0) - parseFloat(amount)} />
                                                </p>
                                            </div>
                                        )}
                                        <FormField
                                            control={form.control}
                                            name="notes"
                                            render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="Notas o Glosa (opcional)"
                                                        as="textarea"
                                                    placeholder="Describa el motivo del traspaso..."
                                                    rows={2}
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </div>
                                </fieldset>
                            </form>
                        </Form>
                    </FormSplitLayout>
                </SkeletonShell>
            </Drawer>
        </>
    )
}

export default TransferDrawer
