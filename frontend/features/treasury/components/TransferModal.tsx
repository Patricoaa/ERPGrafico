"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeftRight, DollarSign, Calendar as CalendarIcon, Info } from "lucide-react"
import { TreasuryAccountSelector } from "@/components/selectors"
import { PeriodValidationDateInput } from "@/components/shared"
import { formatCurrency, cn } from "@/lib/utils"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"
import { Form, FormField } from "@/components/ui/form"
import { CancelButton, LabeledInput, FormSection, FormFooter, FormSplitLayout, ActionSlideButton, BaseModal } from "@/components/shared"

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

interface TreasuryAccount {
    id: number
    name: string
    account_type: 'BANK' | 'CASH'
    current_balance: number
}

interface TransferModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function TransferModal({ open, onOpenChange, onSuccess }: TransferModalProps) {
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const { serverDate } = useServerDate()
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

    useEffect(() => {
        if (open) {
            fetchAccounts()
        }
    }, [open])

    const fetchAccounts = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/accounts/')
            setAccounts(response.data)
        } catch (error) {
            toast.error("Error al cargar cuentas.")
        } finally {
            setLoading(false)
        }
    }

    const onSubmit = async (values: TransferFormValues) => {
        try {
            setSubmitting(true)
            const payload = {
                from_account_id: values.from_account_id,
                to_account_id: values.to_account_id,
                amount: parseFloat(values.amount),
                notes: values.notes,
                date: values.date.toISOString().split('T')[0] + 'T' + new Date().toTimeString().split(' ')[0]
            }

            await api.post('/treasury/dashboard/register_transfer/', payload)

            toast.success("Traspaso registrado correctamente.")
            onOpenChange(false)
            if (onSuccess) onSuccess()
            form.reset()
        } catch (error: unknown) {
            console.error(error)
            showApiError(error, "Error al registrar el traspaso.")
        } finally {
            setSubmitting(false)
        }
    }

    const sourceAccount = accounts.find(a => a.id.toString() === fromAccountId)
    const destAccount = accounts.find(a => a.id.toString() === toAccountId)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            hideScrollArea={true}
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-3">
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                    <span>Traspaso entre Cuentas</span>
                </div>
            }
            description="Mueva fondos entre sus cuentas de tesorería de forma inmediata."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
                            <ActionSlideButton
                                loading={submitting}
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={submitting || !isDateValid}
                                className="bg-amber-500 hover:bg-amber-600 shadow-amber-500/10"
                            >
                                Confirmar Traspaso
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <FormSplitLayout>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* Section 1: Accounts */}
                        <div className="space-y-4">
                            <FormSection title="Flujo de Fondos" icon={ArrowLeftRight} />
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-2 relative">
                                    <FormField
                                        control={form.control}
                                        name="from_account_id"
                                        render={({ field, fieldState }) => (
                                            <div className="relative">
                                                <TreasuryAccountSelector
                                                    label="Cuenta Origen"
                                                    value={field.value}
                                                    onChange={(v) => field.onChange(v ?? "")}
                                                    excludeId={toAccountId ? Number(toAccountId) : undefined}
                                                    error={fieldState.error?.message}
                                                />
                                                {sourceAccount && (
                                                    <div className="absolute -bottom-5 right-1 px-1.5 py-0.5 rounded bg-muted/30 border border-muted/50">
                                                        <p className="text-[10px] font-mono leading-none"> {/* intentional: badge density */}
                                                            DISP: <span className="font-bold text-emerald-600">{formatCurrency(sourceAccount.current_balance)}</span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    />
                                </div>

                                <div className="col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="to_account_id"
                                        render={({ field, fieldState }) => (
                                            <TreasuryAccountSelector
                                                label="Cuenta Destino"
                                                value={field.value}
                                                onChange={(v) => field.onChange(v ?? "")}
                                                excludeId={fromAccountId ? Number(fromAccountId) : undefined}
                                                error={fieldState.error?.message}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Transaction Details */}
                        <div className="space-y-4">
                            <FormSection title="Detalles de la Transacción" icon={DollarSign} />
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-4">
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
                                </div>

                                <div className="col-span-2">
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
                                </div>

                                <div className="col-span-2 flex items-end">
                                    {sourceAccount && toAccountId && amount && !isNaN(parseFloat(amount)) && (
                                        <div className="w-full p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
                                            <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1"> {/* intentional: badge density */} Impacto en Origen</p>
                                            <p className="text-xs font-black text-amber-700">
                                                {formatCurrency(sourceAccount.current_balance - parseFloat(amount))}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-4">
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Notas o Glosa"
                                                as="textarea"
                                                placeholder="Describa el motivo del traspaso..."
                                                rows={2}
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </Form>
            </FormSplitLayout>
        </BaseModal>
    )
}

export default TransferModal
