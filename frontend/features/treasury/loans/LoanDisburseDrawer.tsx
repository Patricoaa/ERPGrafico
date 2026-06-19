"use client"

import React, { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import * as z from 'zod'
import { Form, FormField } from '@/components/ui/form'
import {
    Drawer, LabeledInput, FormSection, FormFooter,
    CancelButton, ActionSlideButton, MoneyDisplay,
} from '@/components/shared'
import { Send, AlertCircle, Settings } from 'lucide-react'
import { useLoanMutations } from './hooks'
import { showApiError } from '@/lib/errors'
import { AccountSelector } from '@/components/selectors/AccountSelector'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useTreasurySettings } from '@/features/settings'
import type { BankLoan } from './types'

const schema = z.object({
    date: z.string().min(1, 'Fecha es requerida'),
    opening_fee: z.string().min(1, 'Comisión apertura es requerida'),
    stamp_tax: z.string().min(1, 'Impuesto timbres es requerido'),
    commission_expense_account: z.string().optional(),
    stamp_tax_expense_account: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    loan: BankLoan | null
    onSuccess?: () => void
}

export function LoanDisburseDrawer({ open, onOpenChange, loan, onSuccess }: Props) {
    const { disburse, isDisbursing } = useLoanMutations()

    // Leemos la config de tesorería para saber si los settings de gastos
    // están definidos. Si NO lo están y hay cargos > 0, mostramos los
    // selectores como escape híbrido (Opción C).
    const { settings: treasurySettings } = useTreasurySettings()

    const defaultValues = useMemo<FormValues>(() => ({
        date: new Date().toISOString().slice(0, 10),
        opening_fee: loan?.opening_fee ?? '0',
        stamp_tax: loan?.stamp_tax ?? '0',
        commission_expense_account: '',
        stamp_tax_expense_account: '',
    }), [loan])

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
        defaultValues,
    })

    useEffect(() => {
        if (open) {
            form.reset(defaultValues)
        }
    }, [open, defaultValues, form])

    // Detección reactiva: ¿hay cargos > 0 sin setting definido?
    const openingFee = parseFloat(form.watch('opening_fee') ?? '0')
    const stampTax = parseFloat(form.watch('stamp_tax') ?? '0')
    const hasOpeningFee = openingFee > 0
    const hasStampTax = stampTax > 0
    const settingHasCommission = !!treasurySettings?.loan_commission_expense_account
    const settingHasStampTax = !!treasurySettings?.loan_stamp_tax_expense_account
    const showCommissionSelector = hasOpeningFee && !settingHasCommission
    const showStampTaxSelector = hasStampTax && !settingHasStampTax
    const anySelectorShown = showCommissionSelector || showStampTaxSelector

    if (!loan) return null

    const onSubmit = async (values: FormValues) => {
        try {
            await disburse({
                id: loan.id,
                payload: {
                    date: values.date,
                    opening_fee: values.opening_fee,
                    stamp_tax: values.stamp_tax,
                    commission_expense_account: values.commission_expense_account
                        ? parseInt(values.commission_expense_account)
                        : null,
                    stamp_tax_expense_account: values.stamp_tax_expense_account
                        ? parseInt(values.stamp_tax_expense_account)
                        : null,
                },
            })
            onSuccess?.()
            onOpenChange(false)
        } catch (error) {
            showApiError(error, "Error al desembolsar crédito")
        }
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="right"
            defaultSize="560px"
            minSize="480px"
            maxSize="720px"
            resizable
            title={
                <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-muted-foreground" />
                    <span>Desembolsar Crédito</span>
                </div>
            }
            subtitle={
                <div className="space-y-1">
                    <div>
                        <span className="font-semibold">{loan.display_id}</span>
                        {' — '}
                        {loan.lender_name}
                        {loan.loan_number ? ` · ${loan.loan_number}` : ''}
                    </div>
                    <div className="text-xs">
                        Capital:&nbsp;
                        <MoneyDisplay amount={parseFloat(loan.principal)} />
                        {' · '}
                        Plazo: {loan.term_months} meses
                    </div>
                </div>
            }
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                loading={isDisbursing}
                                disabled={isDisbursing}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                Confirmar Desembolso
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                    <FormSection title="Datos del Desembolso" icon={Send} />
                    <div className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Fecha de Desembolso"
                                    type="date"
                                    required
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    </div>

                    <FormSection title="Cargos Materializados" icon={Send} />
                    <p className="text-xs text-muted-foreground -mt-2">
                        Edita los cargos que se aplicarán <strong>en este desembolso</strong>.
                        Si difieren del contrato original ({loan.opening_fee} apertura, {loan.stamp_tax} timbres),
                        la diferencia se registrará en las notas del movimiento.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="opening_fee"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Comisión de Apertura"
                                    type="number"
                                    step="0.01"
                                    required
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="stamp_tax"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Impuesto de Timbres"
                                    type="number"
                                    step="0.01"
                                    required
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    </div>

                    {anySelectorShown && (
                        <FormSection title="Cuentas de Gasto (escape)" icon={Settings} />
                    )}
                    {anySelectorShown && (
                        <p className="text-xs text-muted-foreground -mt-2">
                            Los settings de Tesorería no tienen configuradas las cuentas de
                            gasto financiero. Selecciónelas acá o configúrelas en
                            <strong> Configuración &rsaquo; Tesorería &rsaquo; Cuentas de Gasto Financiero</strong>.
                        </p>
                    )}

                    {showCommissionSelector && (
                        <FormField
                            control={form.control}
                            name="commission_expense_account"
                            render={({ field, fieldState }) => (
                                <AccountSelector
                                    label="Cuenta de Gasto — Comisión Apertura"
                                    value={field.value}
                                    onChange={(v) => field.onChange(v ?? '')}
                                    accountType="EXPENSE"
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    )}

                    {showStampTaxSelector && (
                        <FormField
                            control={form.control}
                            name="stamp_tax_expense_account"
                            render={({ field, fieldState }) => (
                                <AccountSelector
                                    label="Cuenta de Gasto — Impuesto de Timbres (ITE)"
                                    value={field.value}
                                    onChange={(v) => field.onChange(v ?? '')}
                                    accountType="EXPENSE"
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    )}

                    {(showCommissionSelector || showStampTaxSelector) && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Escape por desembolso</AlertTitle>
                            <AlertDescription>
                                Está configurando las cuentas sólo para este desembolso.
                                Para que el sistema las use siempre, configúrelas en
                                Configuración &rsaquo; Tesorería &rsaquo; Cuentas de Gasto Financiero.
                            </AlertDescription>
                        </Alert>
                    )}
                </form>
            </Form>
        </Drawer>
    )
}
