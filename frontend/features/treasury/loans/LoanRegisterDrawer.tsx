"use client"

import React, { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import * as z from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Form, FormField } from '@/components/ui/form'
import {
    Drawer, LabeledInput, LabeledSelect, FormSection, FormFooter,
    CancelButton, ActionSlideButton,
    DataCell, DataTableColumnHeader, DataTable,
} from '@/components/shared'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Banknote, Calculator } from 'lucide-react'
import { useBanks } from '../hooks/useMasterData'
import { useTreasuryAccounts } from '../hooks/useTreasuryAccounts'
import { useLoanMutations } from './hooks'
import { AccountSelector } from '@/components/selectors/AccountSelector'

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
    opening_fee: z.string().optional(),
    stamp_tax: z.string().optional(),
    penalty_rate: z.string().optional(),
    disbursement_account: z.string().min(1, 'Cuenta de desembolso es requerida'),
    liability_account: z.string().min(1, 'Cuenta contable de pasivo es requerida'),
    notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    bankId?: number
}

export function LoanRegisterDrawer({ open, onOpenChange, bankId }: Props) {
    const { banks } = useBanks()
    const { accounts } = useTreasuryAccounts()
    const { create, isCreating } = useLoanMutations()

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
        defaultValues: {
            lender: bankId ? String(bankId) : '',
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
            opening_fee: '0',
            stamp_tax: '0',
            penalty_rate: '0',
            disbursement_account: '',
            liability_account: '',
            notes: '',
        },
    })

    useEffect(() => {
        if (open && bankId) {
            form.setValue('lender', String(bankId))
        }
    }, [open, bankId, form])

    // Filtrar cuentas de desembolso: sólo CHECKING o CASH, y si hay bankId
    // acotamos a las del banco seleccionado.
    const disbursementAccounts = useMemo(
        () => (accounts ?? []).filter((a) => {
            const typeOk = a.account_type === 'CHECKING' || a.account_type === 'CASH'
            const bankOk = bankId ? a.bank === bankId : true
            return typeOk && bankOk
        }),
        [accounts, bankId],
    )

    // ── Amortización proyectada (cálculo local) ────────────────────────
    const formValues = useWatch({ control: form.control })

    const scheduleData = useMemo(() => {
        const P = parseFloat(formValues.principal ?? '0') || 0
        const rateRaw = parseFloat(formValues.interest_rate ?? '0') || 0
        const n = parseInt(formValues.term_months ?? '0') || 0
        const insurance = parseFloat(formValues.insurance_monthly ?? '0') || 0
        const firstDue = formValues.first_due_date

        if (P <= 0 || rateRaw <= 0 || n <= 0 || !firstDue) return []

        let i = rateRaw / 100
        if (formValues.rate_basis === 'ANNUAL') {
            i = i / 12
        }

        const system = formValues.amortization_system || 'FRENCH'
        let balance = P
        const rows: Array<{
            number: number
            due_date: string
            principal_amount: string
            interest_amount: string
            insurance_amount: string
            total_amount: string
            outstanding_balance: string
        }> = []

        if (system === 'FRENCH') {
            let C = 0
            if (i === 0) {
                C = P / n
            } else {
                const factor = Math.pow(1 + i, n)
                C = P * i * factor / (factor - 1)
            }
            for (let k = 1; k <= n; k++) {
                const interest = balance * i
                let principal = C - interest - insurance
                if (principal < 0) principal = 0
                if (k === n) {
                    principal = balance
                    C = principal + interest + insurance
                }
                const total = principal + interest + insurance
                balance = balance - principal
                rows.push({
                    number: k,
                    due_date: addMonths(firstDue, k - 1),
                    principal_amount: principal.toFixed(2),
                    interest_amount: interest.toFixed(2),
                    insurance_amount: insurance.toFixed(2),
                    total_amount: total.toFixed(2),
                    outstanding_balance: Math.max(balance, 0).toFixed(2),
                })
            }
        } else {
            const capitalConst = P / n
            for (let k = 1; k <= n; k++) {
                const interest = balance * i
                const principal = k === n ? balance : capitalConst
                const total = principal + interest + insurance
                balance = balance - principal
                rows.push({
                    number: k,
                    due_date: addMonths(firstDue, k - 1),
                    principal_amount: principal.toFixed(2),
                    interest_amount: interest.toFixed(2),
                    insurance_amount: insurance.toFixed(2),
                    total_amount: total.toFixed(2),
                    outstanding_balance: Math.max(balance, 0).toFixed(2),
                })
            }
        }

        return rows
    }, [formValues])

    const scheduleColumns: ColumnDef<typeof scheduleData[number]>[] = [
        { accessorKey: 'number', header: '#', cell: ({ row }) => <DataCell.Text>{row.original.number}</DataCell.Text> },
        { accessorKey: 'due_date', header: 'Vencimiento', cell: ({ row }) => <DataCell.Date value={row.original.due_date} /> },
        { accessorKey: 'principal_amount', header: ({ column }) => <DataTableColumnHeader column={column} title="Capital" />, cell: ({ row }) => <DataCell.Currency value={row.original.principal_amount} digits={0} /> },
        { accessorKey: 'interest_amount', header: ({ column }) => <DataTableColumnHeader column={column} title="Interés" />, cell: ({ row }) => <DataCell.Currency value={row.original.interest_amount} digits={0} /> },
        { accessorKey: 'insurance_amount', header: ({ column }) => <DataTableColumnHeader column={column} title="Seguro" />, cell: ({ row }) => <DataCell.Currency value={row.original.insurance_amount} digits={0} /> },
        { accessorKey: 'total_amount', header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />, cell: ({ row }) => <DataCell.Currency value={row.original.total_amount} digits={0} /> },
        { accessorKey: 'outstanding_balance', header: ({ column }) => <DataTableColumnHeader column={column} title="Saldo" />, cell: ({ row }) => <DataCell.Currency value={row.original.outstanding_balance} digits={0} /> },
    ]

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
            opening_fee: values.opening_fee || '0',
            stamp_tax: values.stamp_tax || '0',
            penalty_rate: values.penalty_rate || '0',
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
            defaultSize="960px"
            minSize="720px"
            maxSize="1280px"
            resizable
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                    <FormSection title="Entidad" icon={Banknote} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="lender"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Banco Acreedor"
                                    required
                                    disabled={!!bankId}
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

                    <FormSection title="Cargos del Contrato (opcional)" icon={Banknote} />
                    <p className="text-xs text-muted-foreground -mt-2">
                        Valores pactados. Podrás editarlos al momento de desembolsar.
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="opening_fee"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Comisión de Apertura"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="stamp_tax"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Impuesto de Timbres"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="penalty_rate"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Tasa de Mora (mensual %)"
                                    type="number"
                                    step="0.0001"
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
                    <div className="space-y-4">
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
                                <div className="space-y-1">
                                    <AccountSelector
                                        label="Cuenta Contable de Pasivo (Préstamo por pagar — 2.x)"
                                        value={field.value}
                                        onChange={(v) => field.onChange(v ?? '')}
                                        accountType="LIABILITY"
                                        error={fieldState.error?.message}
                                    />
                                </div>
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

            {scheduleData.length > 0 && (
                <div className="border-t border-border mt-4 pt-4 px-4 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Tabla de Amortización Proyectada</h3>
                    </div>
                    <DataTable
                        columns={scheduleColumns}
                        data={scheduleData}
                        variant="minimal"
                        noBorder
                        hidePagination
                    />
                </div>
            )}
        </Drawer>
    )
}

function addMonths(start: string, k: number): string {
    const date = new Date(start)
    const year = date.getFullYear() + Math.floor((date.getMonth() + k) / 12)
    const month = (date.getMonth() + k) % 12
    const day = Math.min(date.getDate(), new Date(year, month + 1, 0).getDate())
    return new Date(year, month, day).toISOString().split('T')[0]
}
