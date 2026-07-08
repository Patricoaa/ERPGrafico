"use client"

import { Button } from '@/components/ui/button'
import { showApiError } from '@/lib/errors'
import { BaseModal, MoneyDisplay, LabeledInput, LabeledSelect } from '@/components/shared'
import { toast } from 'sonner'
import { useServerDate } from '@/hooks/useServerDate'
import { treasuryApi } from '../api/treasuryApi'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

interface AddChargeModalProps {
    cardAccountId: number
    cardAccountName: string
    currency?: string
    onSuccess: () => void
    onCancel: () => void
}

const CHARGE_TYPES = [
    { value: 'COMMISSION', label: 'Comisión' },
    { value: 'TAX', label: 'Impuesto' },
    { value: 'FEE', label: 'Cargo' },
    { value: 'INSURANCE', label: 'Seguro' },
    { value: 'INTEREST', label: 'Interés' },
    { value: 'OTHER', label: 'Otro' },
]

const addChargeSchema = z.object({
    amount: z.string().min(1, "El monto es requerido"),
    chargeType: z.string().min(1, "El tipo es requerido"),
    description: z.string().optional(),
    date: z.string().min(1, "La fecha es requerida"),
})

type AddChargeFormValues = z.infer<typeof addChargeSchema>

export function AddChargeModal({
    cardAccountId,
    cardAccountName,
    currency = 'CLP',
    onSuccess,
    onCancel,
}: AddChargeModalProps) {
    const { dateString } = useServerDate()

    const form = useForm<AddChargeFormValues>({
        resolver: zodResolver(addChargeSchema),
        defaultValues: {
            amount: "",
            chargeType: "OTHER",
            description: "",
            date: dateString || new Date().toISOString().split('T')[0],
        },
    })

    const amount = form.watch("amount")
    const numericAmount = parseFloat(amount) || 0
    const loading = form.formState.isSubmitting

    const handleSubmit = async (data: AddChargeFormValues) => {
        if (!data.amount || parseFloat(data.amount) <= 0) {
            toast.error('El monto debe ser mayor a cero')
            return
        }

        try {
            await treasuryApi.addUnbilledCharge({
                card_account: cardAccountId,
                amount: parseFloat(data.amount),
                charge_type: data.chargeType,
                description: data.description ?? "",
                date: data.date,
            })
            onSuccess()
        } catch (error) {
            showApiError(error, 'Error al agregar cargo')
        }
    }

    return (
        <BaseModal
            open
            onOpenChange={onCancel}
            title="Agregar Cargo No Facturado"
            description={`Cargo a la tarjeta ${cardAccountName}`}
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="add-charge-form" disabled={loading || !amount || parseFloat(amount) <= 0}>
                        {loading ? 'Agregando...' : 'Agregar Cargo'}
                    </Button>
                </div>
            }
        >
            <form id="add-charge-form" onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="space-y-4">
                    {numericAmount > 0 && (
                        <div className="rounded-md border bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground">Monto</div>
                            <div className="text-xl font-bold">
                                <MoneyDisplay amount={numericAmount} currency={currency} />
                            </div>
                        </div>
                    )}
                    <LabeledInput
                        label="Monto"
                        type="number"
                        step="1"
                        min="0"
                        {...form.register("amount")}
                        placeholder="0"
                        required
                    />
                    {form.formState.errors.amount && (
                        <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                    )}
                    <LabeledSelect
                        label="Tipo de Cargo"
                        options={CHARGE_TYPES}
                        value={form.watch("chargeType")}
                        onChange={(v) => form.setValue("chargeType", v)}
                        placeholder="Seleccionar tipo"
                        required
                    />
                    <LabeledInput
                        label="Fecha"
                        type="date"
                        {...form.register("date")}
                        required
                    />
                    <LabeledInput
                        label="Descripción (opcional)"
                        as="textarea"
                        rows={3}
                        {...form.register("description")}
                        placeholder="Descripción del cargo"
                    />
                </div>
            </form>
        </BaseModal>
    )
}
