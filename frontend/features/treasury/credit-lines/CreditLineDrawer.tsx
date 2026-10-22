'use client'

import { useEffect, useState } from 'react'
import { useInitializeDrawerForm } from '@/hooks/useInitializeDrawerForm'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreditLineMutations } from '../hooks/useCreditLines'
import { Drawer, SubmitButton, LabeledInput, LabeledSelect, LabeledCheckbox } from '@/components/shared'
import { Button } from '@/components/ui/button'
import type { CreditLine, CreditLineCreatePayload } from './types'
import type { TreasuryAccount } from '../types'
import { treasuryApi } from '@/features/treasury'

const schema = z.object({
    treasury_account: z.number(),
    code: z.string().optional(),
    currency: z.string().default('CLP'),
    credit_limit: z.string().min(1, 'Requerido'),
    interest_rate: z.string().optional(),
    rate_basis: z.enum(['MONTHLY', 'ANNUAL']).optional(),
    spread: z.string().optional(),
    commitment_fee: z.string().optional(),
    valid_from: z.string().min(1, 'Requerido'),
    valid_until: z.string().optional().nullable(),
    auto_renewal: z.boolean().default(false),
    renewal_term_months: z.coerce.number().optional().nullable(),
    collateral_notes: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELED', 'SUSPENDED']).default('ACTIVE'),
})

type FormValues = z.infer<typeof schema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    creditLine?: CreditLine | null
    creditLineId?: number | null
    treasuryAccountId?: number
}

export function CreditLineDrawer({ open, onOpenChange, creditLine, creditLineId, treasuryAccountId }: Props) {
    const { create, update } = useCreditLineMutations()
    const [checkingAccounts, setCheckingAccounts] = useState<TreasuryAccount[]>([])
    const [accountName, setAccountName] = useState('')
    const resolvedCreditLine = creditLine ?? null
    const isEditing = !!resolvedCreditLine || !!creditLineId

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
        defaultValues: {
            treasury_account: treasuryAccountId ?? 0,
            code: '',
            currency: 'CLP',
            credit_limit: '',
            interest_rate: '',
            rate_basis: 'MONTHLY',
            spread: '0',
            commitment_fee: '0',
            valid_from: '',
            valid_until: null,
            auto_renewal: false,
            renewal_term_months: null,
            collateral_notes: '',
            notes: '',
            status: 'ACTIVE',
        },
    })

    useInitializeDrawerForm({
        form,
        open,
        initialData: creditLine,
        defaultValues: () => ({
            treasury_account: treasuryAccountId ?? 0,
            code: '',
            currency: 'CLP' as const,
            credit_limit: '',
            interest_rate: '',
            rate_basis: 'MONTHLY' as const,
            spread: '0',
            commitment_fee: '0',
            valid_from: '',
            valid_until: null,
            auto_renewal: false,
            renewal_term_months: null,
            collateral_notes: '',
            notes: '',
            status: 'ACTIVE' as const,
        }),
        mapData: (data) => ({
            treasury_account: data.treasury_account,
            code: data.code || '',
            currency: data.currency,
            credit_limit: data.credit_limit,
            interest_rate: data.interest_rate,
            rate_basis: data.rate_basis ?? 'MONTHLY',
            spread: data.spread,
            commitment_fee: data.commitment_fee,
            valid_from: data.valid_from,
            valid_until: data.valid_until,
            auto_renewal: data.auto_renewal,
            renewal_term_months: data.renewal_term_months,
            collateral_notes: data.collateral_notes,
            notes: data.notes,
            status: data.status,
        }),
    })

    useEffect(() => {
        if (!open) return
        const load = async () => {
            const accounts = await treasuryApi.getAccounts({ account_type: 'CHECKING' })
            setCheckingAccounts(accounts)
            const taId = creditLine?.treasury_account ?? treasuryAccountId
            if (taId) {
                const acc = accounts.find((a: TreasuryAccount) => a.id === taId)
                setAccountName(acc?.name ?? '')
            }
        }
        load()
    }, [open, creditLine, treasuryAccountId])

    const onSubmit = async (values: FormValues) => {
        if (isEditing && resolvedCreditLine) {
            await update.mutateAsync({ id: resolvedCreditLine.id, data: values })
        } else {
            await create.mutateAsync(values as unknown as CreditLineCreatePayload)
        }
        onOpenChange(false)
    }

    const accountOptions = checkingAccounts.map((a: TreasuryAccount) => ({
        value: String(a.id),
        label: `${a.name} (${a.bank_name ?? 'Sin banco'})`,
    }))

    const currencyOptions = [
        { value: 'CLP', label: 'CLP' },
        { value: 'UF', label: 'UF' },
    ]

    const rateBasisOptions = [
        { value: 'MONTHLY', label: 'Mensual' },
        { value: 'ANNUAL', label: 'Anual' },
    ]

    // Use boundary="screen" since this drawer opens on top of another drawer (TreasuryAccountDrawer)
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="right"
            title={isEditing ? 'Editar Línea de Crédito' : 'Nueva Línea de Crédito'}
            subtitle="Configure los términos del sobregiro para la cuenta bancaria."
            className="w-full sm:max-w-lg overflow-y-auto"
            boundary="screen"
            footer={
                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <SubmitButton type="submit" form="credit-line-form" loading={create.isPending || update.isPending}>
                        {isEditing ? 'Guardar' : 'Crear'}
                    </SubmitButton>
                </div>
            }
        >
            <form id="credit-line-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                {/* Cuenta Bancaria */}
                <Controller control={form.control} name="treasury_account" render={({ field }) => (
                    treasuryAccountId ? (
                        <LabeledInput
                            name={field.name}
                            value={accountName || `Cuenta #${treasuryAccountId}`}
                            disabled
                            label="Cuenta Bancaria"
                        />
                    ) : (
                        <LabeledSelect
                            value={field.value ? String(field.value) : ''}
                            onChange={(v) => {
                                field.onChange(Number(v))
                                const acc = checkingAccounts.find((a: TreasuryAccount) => a.id === Number(v))
                                setAccountName(acc?.name ?? '')
                            }}
                            label="Cuenta Bancaria"
                            options={accountOptions}
                            placeholder="Seleccionar cuenta"
                        />
                    )
                )} />

                <div className="grid grid-cols-2 gap-4">
                    {/* Código */}
                    <LabeledInput
                        {...form.register('code')}
                        label="Código"
                        placeholder="Código opcional"
                    />

                    {/* Moneda */}
                    <Controller control={form.control} name="currency" render={({ field }) => (
                        <LabeledSelect
                            value={field.value}
                            onChange={field.onChange}
                            label="Moneda"
                            options={currencyOptions}
                        />
                    )} />
                </div>

                {/* Límite de Crédito */}
                <LabeledInput
                    {...form.register('credit_limit')}
                    label="Límite de Crédito"
                    type="number"
                    step="1"
                    placeholder="Ej: 5000000"
                />

                <div className="grid grid-cols-3 gap-4">
                    {/* Tasa % */}
                    <LabeledInput
                        {...form.register('interest_rate')}
                        label="Tasa %"
                        type="number"
                        step="0.0001"
                        placeholder="Ej: 1.5"
                    />

                    {/* Base */}
                    <Controller control={form.control} name="rate_basis" render={({ field }) => (
                        <LabeledSelect
                            value={field.value}
                            onChange={field.onChange}
                            label="Base"
                            options={rateBasisOptions}
                        />
                    )} />

                    {/* Spread % */}
                    <LabeledInput
                        {...form.register('spread')}
                        label="Spread %"
                        type="number"
                        step="0.0001"
                        placeholder="0"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Vigencia Desde */}
                    <LabeledInput
                        {...form.register('valid_from')}
                        label="Vigencia Desde"
                        type="date"
                    />

                    {/* Vigencia Hasta */}
                    <LabeledInput
                        {...form.register('valid_until')}
                        label="Vigencia Hasta"
                        type="date"
                    />
                </div>

                {/* Renovación Automática */}
                <Controller control={form.control} name="auto_renewal" render={({ field }) => (
                    <LabeledCheckbox
                        label="Renovación Automática"
                        description="Renovar la línea de crédito automáticamente al vencer"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                )} />

                {form.watch('auto_renewal') && (
                    <LabeledInput
                        {...form.register('renewal_term_months')}
                        label="Plazo Renovación (meses)"
                        type="number"
                        placeholder="Ej: 12"
                    />
                )}

                {/* Garantías */}
                <LabeledInput
                    {...form.register('collateral_notes')}
                    label="Garantías"
                    placeholder="Detalle de garantías..."
                />

                {/* Notas */}
                <LabeledInput
                    {...form.register('notes')}
                    label="Notas"
                    placeholder="Notas adicionales..."
                />
            </form>
        </Drawer>
    )
}