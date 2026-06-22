'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreditLineMutations } from './hooks'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { CreditLine, CreditLineCreatePayload } from './types'
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
    const [checkingAccounts, setCheckingAccounts] = useState<any[]>([])
    const [accountName, setAccountName] = useState('')
    const resolvedCreditLine = creditLine ?? null
    const isEditing = !!resolvedCreditLine || !!creditLineId

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
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

    useEffect(() => {
        if (!open) return
        const load = async () => {
            // Load CHECKING accounts for selector
            const accounts = await treasuryApi.getAccounts({ account_type: 'CHECKING' })
            setCheckingAccounts(accounts)

            // If editing, load credit line data
            if (creditLine) {
                const taId = creditLine.treasury_account
                const acc = accounts.find((a: any) => a.id === taId)
                setAccountName(acc?.name ?? '')
                form.reset({
                    treasury_account: taId,
                    code: creditLine.code || '',
                    currency: creditLine.currency,
                    credit_limit: creditLine.credit_limit,
                    interest_rate: creditLine.interest_rate,
                    rate_basis: creditLine.rate_basis ?? 'MONTHLY',
                    spread: creditLine.spread,
                    commitment_fee: creditLine.commitment_fee,
                    valid_from: creditLine.valid_from,
                    valid_until: creditLine.valid_until,
                    auto_renewal: creditLine.auto_renewal,
                    renewal_term_months: creditLine.renewal_term_months,
                    collateral_notes: creditLine.collateral_notes,
                    notes: creditLine.notes,
                    status: creditLine.status,
                })
            } else if (treasuryAccountId) {
                const acc = accounts.find((a: any) => a.id === treasuryAccountId)
                setAccountName(acc?.name ?? '')
                form.reset({ treasury_account: treasuryAccountId })
            }
        }
        load()
    }, [open, creditLine, treasuryAccountId, form])

    const onSubmit = async (values: FormValues) => {
        if (isEditing && resolvedCreditLine) {
            await update.mutateAsync({ id: resolvedCreditLine.id, data: values })
        } else {
            await create.mutateAsync(values as unknown as CreditLineCreatePayload)
        }
        onOpenChange(false)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{isEditing ? 'Editar' : 'Nueva'} Línea de Crédito</SheetTitle>
                    <SheetDescription>
                        Configure los términos del sobregiro para la cuenta bancaria.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                        <FormField control={form.control} name="treasury_account" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cuenta Bancaria</FormLabel>
                                {treasuryAccountId ? (
                                    <FormControl>
                                        <Input value={accountName || `Cuenta #${treasuryAccountId}`} disabled />
                                    </FormControl>
                                ) : (
                                    <Select
                                        value={String(field.value)}
                                        onValueChange={(v) => {
                                            field.onChange(Number(v))
                                            const acc = checkingAccounts.find((a: any) => a.id === Number(v))
                                            setAccountName(acc?.name ?? '')
                                        }}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {checkingAccounts.map((a: any) => (
                                                <SelectItem key={a.id} value={String(a.id)}>
                                                    {a.name} ({a.bank_name ?? 'Sin banco'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="currency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Moneda</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="CLP">CLP</SelectItem>
                                            <SelectItem value="UF">UF</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="credit_limit" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Límite de Crédito</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="interest_rate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tasa %</FormLabel>
                                    <FormControl><Input type="number" step="0.0001" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="rate_basis" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Base</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="MONTHLY">Mensual</SelectItem>
                                            <SelectItem value="ANNUAL">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="spread" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Spread %</FormLabel>
                                    <FormControl><Input type="number" step="0.0001" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="valid_from" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vigencia Desde</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="valid_until" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vigencia Hasta</FormLabel>
                                    <FormControl>
                                        <Input type="date" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || null)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="auto_renewal" render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="!mt-0">Renovación Automática</FormLabel>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {form.watch('auto_renewal') && (
                            <FormField control={form.control} name="renewal_term_months" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Plazo Renovación (meses)</FormLabel>
                                    <FormControl>
                                        <Input type="number" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}

                        <FormField control={form.control} name="collateral_notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Garantías</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notas</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={create.isPending || update.isPending}>
                                {isEditing ? 'Guardar' : 'Crear'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
