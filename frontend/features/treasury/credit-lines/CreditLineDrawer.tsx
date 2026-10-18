'use client'

import { useEffect, useState } from 'react'
import { useInitializeDrawerForm } from '@/hooks/useInitializeDrawerForm'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreditLineMutations } from '../hooks/useCreditLines'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { LabeledInput, LabeledSelect, LabeledCheckbox, LabeledContainer } from '@/components/shared'
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
    ] as const

    const rateBasisOptions = [
        { value: 'MONTHLY', label: 'Mensual' },
        { value: 'ANNUAL', label: 'Anual' },
    ] as const

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{isEditing ? 'Editar' : 'Nueva'} Línea de Crédito</SheetTitle>
                    <SheetDescription>
                        Configure los términos del sobregiro para la cuenta bancaria.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                    {/* Cuenta Bancaria */}
                    <FormField control={form.control} name="treasury_account" render={({ field }) => (
                        treasuryAccountId ? (
                            <LabeledInput
                                {...field}
                                value={accountName || `Cuenta #${treasuryAccountId}`}
                                disabled
                                label="Cuenta Bancaria"
                            />
                        ) : (
                            <LabeledSelect
                                {...field}
                                value={field.value ? String(field.value) : ''}
                                onValueChange={(v) => {
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
                        <LabeledSelect
                            {...form.register('currency')}
                            label="Moneda"
                            options={currencyOptions}
                        />
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
                        <LabeledSelect
                            {...form.register('rate_basis')}
                            label="Base"
                            options={rateBasisOptions}
                        />

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
                    <LabeledCheckbox
                        {...form.register('auto_renewal')}
                        label="Renovación Automática"
                    />

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

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={create.isPending || update.isPending}>
                            {isEditing ? 'Guardar' : 'Crear'}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    )
}