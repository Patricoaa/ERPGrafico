"use client"

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { showApiError } from '@/lib/errors'
import { BaseModal, MoneyDisplay, LabeledInput, LabeledSelect } from '@/components/shared'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { PendingChargeRow, UpcomingInstallment } from '../types'
import { ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react'

interface BillChargesModalProps {
    cardAccountId: number
    cardAccountName: string
    total: number
    charges: PendingChargeRow[]
    installments?: UpcomingInstallment[]
    currency?: string
    onSuccess: () => void
    onCancel: () => void
}

interface BreakdownItem {
    label: string
    pendingCharges: PendingChargeRow[]
    installmentRows: UpcomingInstallment[]
    subtotal: number
}

function groupByPurchase(
    charges: PendingChargeRow[],
    installments: UpcomingInstallment[],
): BreakdownItem[] {
    const groups = new Map<string, BreakdownItem>()

    if (charges.length > 0) {
        groups.set('pending', {
            label: 'Sin compra asociada',
            pendingCharges: [...charges],
            installmentRows: [],
            subtotal: charges.reduce((s, c) => s + Number(c.amount), 0),
        })
    }

    for (const inst of installments) {
        const key = `uuid-${inst.group_uuid}`
        let g = groups.get(key)
        if (!g) {
            g = {
                label: inst.partner_name || inst.group_display_id || 'Compra en cuotas',
                pendingCharges: [],
                installmentRows: [],
                subtotal: 0,
            }
            groups.set(key, g)
        }
        g.installmentRows.push(inst)
        g.subtotal += Number(inst.principal_amount)
    }

    return Array.from(groups.values())
}

const MONTHS = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
]

export function BillChargesModal({
    cardAccountId,
    cardAccountName,
    total,
    charges,
    installments = [],
    currency = 'CLP',
    onSuccess,
    onCancel,
}: BillChargesModalProps) {
    const [periodYear, setPeriodYear] = useState(new Date().getFullYear())
    const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth() + 1))
    const [cutOffDate, setCutOffDate] = useState(
        new Date().toISOString().split('T')[0]
    )
    const [dueDate, setDueDate] = useState(() => {
        const date = new Date()
        date.setMonth(date.getMonth() + 1)
        return date.toISOString().split('T')[0]
    })
    const [minimumPayment, setMinimumPayment] = useState('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const groupedCharges = useMemo(
        () => groupByPurchase(charges, installments),
        [charges, installments],
    )

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!cutOffDate || !dueDate) {
            toast.error('Las fechas son requeridas')
            return
        }

        try {
            setLoading(true)
            await treasuryApi.billUnbilledCharges({
                card_account: cardAccountId,
                period_year: periodYear,
                period_month: parseInt(periodMonth),
                cut_off_date: cutOffDate,
                due_date: dueDate,
                minimum_payment: minimumPayment ? parseFloat(minimumPayment) : undefined,
                notes,
            })
            onSuccess()
        } catch (error) {
            showApiError(error, 'Error al facturar cargos')
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open
            onOpenChange={onCancel}
            title="Facturar Cargos No Facturados"
            description={`Facturar ${cardAccountName}`}
            size="lg"
            footer={
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="bill-charges-form" disabled={loading}>
                        {loading ? 'Facturando...' : 'Facturar Cargos'}
                    </Button>
                </div>
            }
        >
            <form id="bill-charges-form" onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <div className="rounded-md border bg-muted/20 p-4">
                        <div className="text-sm text-muted-foreground">Total a facturar</div>
                        <div className="text-2xl font-bold">
                            <MoneyDisplay amount={total} currency={currency} />
                        </div>
                    </div>

                    {/* ── Desglose por grupo de compra ── */}
                    {groupedCharges.length > 0 && (
                        <div className="rounded-md border">
                            <div className="border-b bg-muted/30 px-4 py-2 text-sm font-medium text-muted-foreground">
                                Desglose por compra
                            </div>
                            <div className="divide-y">
                                {groupedCharges.map((g, idx) => {
                                    const key = g.label + idx
                                    const isExpanded = expandedGroups.has(key)
                                    return (
                                        <div key={key}>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(key)}
                                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                )}
                                                <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">
                                                        {g.label}
                                                    </div>
                                                    <div className="flex gap-3 text-xs text-muted-foreground">
                                                        {g.installmentRows.length > 0 && (
                                                            <span>{g.installmentRows[0].total_installments} cuotas</span>
                                                        )}
                                                        {g.pendingCharges.length > 0 && (
                                                            <span>{g.pendingCharges.length} cargo(s)</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold tabular-nums shrink-0">
                                                    <MoneyDisplay amount={g.subtotal} currency={currency} />
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="border-t bg-muted/10 px-4 py-2">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-muted-foreground">
                                                                <th className="text-left py-1 pr-2">#</th>
                                                                <th className="text-left py-1 pr-2">Tipo</th>
                                                                <th className="text-left py-1 pr-2">Referencia</th>
                                                                <th className="text-right py-1 pl-2">Monto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {g.installmentRows.map(inst => (
                                                                <tr key={`inst-${inst.id}`} className="border-t border-border/40">
                                                                    <td className="py-1 pr-2 tabular-nums">
                                                                        {inst.number}/{inst.total_installments}
                                                                    </td>
                                                                    <td className="py-1 pr-2">
                                                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-info text-info-foreground">
                                                                            Cuota
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-1 pr-2 truncate max-w-[180px]">
                                                                        {inst.due_date || '-'}
                                                                    </td>
                                                                    <td className="py-1 pl-2 text-right tabular-nums">
                                                                        <MoneyDisplay amount={Number(inst.principal_amount)} currency={currency} />
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {g.pendingCharges.map(c => (
                                                                <tr key={c.id} className="border-t border-border/40">
                                                                    <td className="py-1 pr-2 tabular-nums text-muted-foreground">—</td>
                                                                    <td className="py-1 pr-2">
                                                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-warning text-warning-foreground">
                                                                            {c.charge_type_display}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-1 pr-2 truncate max-w-[180px]">
                                                                        {c.description || c.reference || '-'}
                                                                    </td>
                                                                    <td className="py-1 pl-2 text-right tabular-nums">
                                                                        <MoneyDisplay amount={Number(c.amount)} currency={currency} />
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Año"
                            type="number"
                            min="2020"
                            max="2030"
                            value={periodYear}
                            onChange={(e) => setPeriodYear(parseInt(e.target.value))}
                            required
                        />
                        <LabeledSelect
                            label="Mes"
                            options={MONTHS}
                            value={periodMonth}
                            onChange={setPeriodMonth}
                            placeholder="Seleccionar mes"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Fecha de Cierre"
                            type="date"
                            value={cutOffDate}
                            onChange={(e) => setCutOffDate(e.target.value)}
                            required
                        />
                        <LabeledInput
                            label="Fecha de Vencimiento"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            required
                        />
                    </div>
                    <LabeledInput
                        label="Pago Mínimo (opcional)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={minimumPayment}
                        onChange={(e) => setMinimumPayment(e.target.value)}
                        placeholder="0.00"
                    />
                    <LabeledInput
                        label="Notas (opcional)"
                        as="textarea"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notas sobre la facturación"
                    />
                </div>
            </form>
        </BaseModal>
    )
}
