"use client"

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BaseModal, MoneyDisplay } from '@/components/shared'
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { TreasuryMovement, CardPurchaseGroup, UpcomingInstallment } from '../types'
import { ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react'

interface BillChargesModalProps {
    cardAccountId: number
    cardAccountName: string
    total: number
    charges: TreasuryMovement[]
    installments?: UpcomingInstallment[]
    currency?: string
    onSuccess: () => void
    onCancel: () => void
}

interface BreakdownItem {
    group: CardPurchaseGroup | null
    label: string
    movements: TreasuryMovement[]
    installmentRows: UpcomingInstallment[]
    subtotal: number
}

function groupByPurchase(
    movements: TreasuryMovement[],
    installments: UpcomingInstallment[],
): BreakdownItem[] {
    const groups = new Map<string, BreakdownItem>()

    for (const m of movements) {
        const detail = m.card_purchase_group_detail
        const key = detail?.id != null ? `g-${detail.id}` : 'null'
        let g = groups.get(key)
        if (!g) {
            g = {
                group: detail ?? null,
                label: detail
                    ? `${detail.client_reference || `Compra #${detail.id}`}`
                    : 'Sin compra asociada',
                movements: [],
                installmentRows: [],
                subtotal: 0,
            }
            groups.set(key, g)
        }
        g.movements.push(m)
        g.subtotal += m.amount
    }

    for (const inst of installments) {
        const key = `uuid-${inst.group_uuid}`
        let g = groups.get(key)
        if (!g) {
            g = {
                group: null,
                label: inst.partner_name || inst.group_display_id || 'Compra en cuotas',
                movements: [],
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

function formatCuota(m: TreasuryMovement): string {
    if (m.installment_number && m.card_purchase_group_detail) {
        return `${m.installment_number}/${m.card_purchase_group_detail.installments}`
    }
    return '-'
}

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
    const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1)
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
                period_month: periodMonth,
                cut_off_date: cutOffDate,
                due_date: dueDate,
                minimum_payment: minimumPayment ? parseFloat(minimumPayment) : undefined,
                notes,
            })
            onSuccess()
        } catch {
            toast.error('Error al facturar cargos')
        } finally {
            setLoading(false)
        }
    }

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

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
                                    const key = g.group?.id != null ? String(g.group.id) : `null-${idx}`
                                    const isExpanded = expandedGroups.has(key)
                                    const partnerName = g.group?.partner_name
                                    const firstDate = g.group?.first_installment_date
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
                                                        {partnerName && <span>{partnerName}</span>}
                                                        {(g.group?.installments || g.installmentRows.length > 0) && (
                                                            <span>{g.group?.installments || (g.installmentRows[0]?.total_installments ?? '')} cuotas</span>
                                                        )}
                                                        {firstDate && (
                                                            <span>1era cuota: {firstDate}</span>
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
                                                                <th className="text-left py-1 pr-2">Cuota</th>
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
                                                            {g.movements.map(m => (
                                                                <tr key={m.id} className="border-t border-border/40">
                                                                    <td className="py-1 pr-2 tabular-nums">{formatCuota(m)}</td>
                                                                    <td className="py-1 pr-2">
                                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                            m.is_installment_interest
                                                                                ? 'bg-warning text-warning-foreground'
                                                                                : 'bg-success text-success-foreground'
                                                                        }`}>
                                                                            {m.is_installment_interest ? 'Interés' : 'Capital'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-1 pr-2 truncate max-w-[180px]">
                                                                        {m.reference || '-'}
                                                                    </td>
                                                                    <td className="py-1 pl-2 text-right tabular-nums">
                                                                        <MoneyDisplay amount={m.amount} currency={currency} />
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
                        <div className="grid gap-2">
                            <Label htmlFor="periodYear">Año</Label>
                            <Input
                                id="periodYear"
                                type="number"
                                min="2020"
                                max="2030"
                                value={periodYear}
                                onChange={(e) => setPeriodYear(parseInt(e.target.value))}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="periodMonth">Mes</Label>
                            <select
                                id="periodMonth"
                                value={periodMonth}
                                onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                required
                            >
                                {months.map((month, index) => (
                                    <option key={index + 1} value={index + 1}>
                                        {month}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cutOffDate">Fecha de Cierre</Label>
                            <Input
                                id="cutOffDate"
                                type="date"
                                value={cutOffDate}
                                onChange={(e) => setCutOffDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="minimumPayment">Pago Mínimo (Opcional)</Label>
                        <Input
                            id="minimumPayment"
                            type="number"
                            step="0.01"
                            min="0"
                            value={minimumPayment}
                            onChange={(e) => setMinimumPayment(e.target.value)}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas sobre la facturación"
                        />
                    </div>
                </div>
            </form>
        </BaseModal>
    )
}
