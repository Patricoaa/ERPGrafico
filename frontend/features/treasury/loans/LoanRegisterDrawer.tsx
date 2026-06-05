"use client"

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import * as z from 'zod'
import { Form, FormField } from '@/components/ui/form'
import {
    Drawer, LabeledInput, LabeledSelect, FormSection, FormFooter,
    CancelButton, ActionSlideButton,
} from '@/components/shared'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Banknote } from 'lucide-react'
import { useBanks } from '../hooks/useMasterData'
import { useTreasuryAccounts } from '../hooks/useTreasuryAccounts'
import { useLoanMutations } from './hooks'

const schema = z.object({
    lender: z.string().min(1, 'Banco es requerido'),
    loan_number: z.string().optional(),
    currency: z.enum(['CLP', 'UF']),
    principal: z.string().min(1, 'Capital es requerido'),
    interest_rate: z.string().min(1, 'Tasa es requerida'),
    rate_basis: z.enum(['MONTHLY', 'ANNUAL']),
    amortization_system: z.enum(['FRENCH', 'LINEAR']),
    term_months: z.string().min(1, 'Plazo es requerido'),
    start_date: z.string().min(1, 'Fecha de inicio es requerida'),
    first_due_date: z.string().min(1, 'Primer vencimiento es requerido'),
    insurance_monthly: z.string().optional(),
    disbursement_account: z.string().min(1, 'Cuenta de desembolso es requerida'),
    liability_account: z.string().min(1, 'Cuenta pasivo es requerida'),
    notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LoanRegisterDrawer({ open, onOpenChange }: Props) {
    const { banks } = useBanks()
    const { accounts } = useTreasuryAccounts()
    const { create, isCreating } = useLoanMutations()

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
        defaultValues: {
            lender: '',
            loan_number: '',
            currency: 'CLP',
            principal: '',
            interest_rate: '',
            rate_basis: 'MONTHLY',
            amortization_system: 'FRENCH',
            term_months: '12',
            start_date: '',
            first_due_date: '',
            insurance_monthly: '0',
            disbursement_account: '',
            liability_account: '',
            notes: '',
        },
    })

    const disbursementAccounts = (accounts ?? []).filter(
        (a) => a.account_type === 'CHECKING' || a.account_type === 'CASH',
    )
    const liabilityAccounts = (accounts ?? []).filter(
        (a) => a.account_type === 'LOAN',
    )

    const onSubmit = async (values: FormValues) => {
        await create({
            lender: parseInt(values.lender),
            loan_number: values.loan_number ?? '',
            currency: values.currency,
            principal: values.principal,
            interest_rate: values.interest_rate,
            rate_basis: values.rate_basis,
            amortization_system: values.amortization_system,
            term_months: parseInt(values.term_months),
            start_date: values.start_date,
            first_due_date: values.first_due_date,
            insurance_monthly: values.insurance_monthly || '0',
            disbursement_account: parseInt(values.disbursement_account),
            liability_account: parseInt(values.liability_account),
            notes: values.notes ?? '',
        })
        form.reset()
        onOpenChange(false)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            title={
                <div className="flex items-center gap-3">
                    <Banknote className="h-5 w-5 text-muted-foreground" />
                    <span>Registrar Crédito Bancario</span>
                </div>
            }
            subtitle="Ingresa los datos del crédito. Luego podrás desembolsarlo para activar la tabla de amortización."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                loading={isCreating}
                                disabled={isCreating}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                Registrar Crédito
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-4 pb-4 pt-2">
                    <FormSection title="Entidad" icon={Banknote} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="lender"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Banco Acreedor"
                                    required
                                    options={(banks ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="loan_number"
                            render={({ field }) => (
                                <LabeledInput
                                    label="N° de Operación"
                                    placeholder="Ej: 001-2026"
                                    {...field}
                                />
                            )}
                        />
                    </div>

                    <FormSection title="Condiciones" icon={Banknote} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                                <LabeledSelect
                                    label="Moneda"
                                    required
                                    options={[
                                        { value: 'CLP', label: 'Pesos Chilenos (CLP)' },
                                        { value: 'UF', label: 'Unidad de Fomento (UF)' },
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="principal"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Capital"
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="interest_rate"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Tasa de Interés (%)"
                                    type="number"
                                    step="0.0001"
                                    required
                                    placeholder="1.2000"
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="rate_basis"
                            render={({ field }) => (
                                <LabeledSelect
                                    label="Base de Tasa"
                                    required
                                    options={[
                                        { value: 'MONTHLY', label: 'Mensual' },
                                        { value: 'ANNUAL', label: 'Anual' },
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="amortization_system"
                            render={({ field }) => (
                                <LabeledSelect
                                    label="Sistema de Amortización"
                                    required
                                    options={[
                                        { value: 'FRENCH', label: 'Francés (cuota fija)' },
                                        { value: 'LINEAR', label: 'Lineal (capital fijo)' },
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="term_months"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Plazo (meses)"
                                    type="number"
                                    min="1"
                                    required
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="insurance_monthly"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Seguro Mensual (opcional)"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                />
                            )}
                        />
                    </div>

                    <FormSection title="Fechas" icon={Banknote} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="start_date"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Fecha de Inicio"
                                    type="date"
                                    required
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="first_due_date"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Primer Vencimiento"
                                    type="date"
                                    required
                                    {...field}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    </div>

                    <FormSection title="Cuentas" icon={Banknote} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="disbursement_account"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Cuenta de Desembolso (Banco/Caja)"
                                    required
                                    options={disbursementAccounts.map((a) => ({
                                        value: String(a.id), label: `${a.name} (${a.code})`,
                                    }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="liability_account"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Cuenta Pasivo (Línea de Crédito)"
                                    required
                                    options={liabilityAccounts.map((a) => ({
                                        value: String(a.id), label: `${a.name} (${a.code})`,
                                    }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <div className="space-y-2">
                                <Label htmlFor="loan-notes">Notas</Label>
                                <Textarea
                                    id="loan-notes"
                                    placeholder="Información adicional sobre el crédito…"
                                    rows={3}
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                />
                            </div>
                        )}
                    />
                </form>
            </Form>
        </Drawer>
    )
}
