"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { showApiError } from '@/lib/errors'
import { BaseModal, MoneyDisplay, LabeledInput, LabeledSelect } from '@/components/shared'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'

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

export function AddChargeModal({
    cardAccountId,
    cardAccountName,
    currency = 'CLP',
    onSuccess,
    onCancel,
}: AddChargeModalProps) {
    const [amount, setAmount] = useState('')
    const [chargeType, setChargeType] = useState('OTHER')
    const [description, setDescription] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!amount || parseFloat(amount) <= 0) {
            toast.error('El monto debe ser mayor a cero')
            return
        }

        try {
            setLoading(true)
            await treasuryApi.addUnbilledCharge({
                card_account: cardAccountId,
                amount: parseFloat(amount),
                charge_type: chargeType,
                description,
                date,
            })
            onSuccess()
        } catch (error) {
            showApiError(error, 'Error al agregar cargo')
        } finally {
            setLoading(false)
        }
    }

    const numericAmount = parseFloat(amount) || 0

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
            <form id="add-charge-form" onSubmit={handleSubmit}>
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
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                    />
                    <LabeledSelect
                        label="Tipo de Cargo"
                        options={CHARGE_TYPES}
                        value={chargeType}
                        onChange={setChargeType}
                        placeholder="Seleccionar tipo"
                        required
                    />
                    <LabeledInput
                        label="Fecha"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                    />
                    <LabeledInput
                        label="Descripción (opcional)"
                        as="textarea"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descripción del cargo"
                    />
                </div>
            </form>
        </BaseModal>
    )
}
