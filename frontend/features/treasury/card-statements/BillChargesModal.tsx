"use client"

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { showApiError } from '@/lib/errors'
import { BaseModal, MoneyDisplay, LabeledInput, LabeledSelect } from '@/components/shared'
import { toast } from 'sonner'
import { useServerDate } from '@/hooks/useServerDate'
import { treasuryApi } from '../api/treasuryApi'
import type { PendingChargeRow, UpcomingInstallment } from '../types'
import { ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

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

const billChargesSchema = z.object({
    periodYear: z.number().min(2020, "Año inválido").max(2030, "Año inválido"),
    periodMonth: z.string().min(1, "El mes es requerido"),
    cutOffDate: z.string().min(1, "La fecha de cierre es requerida"),
    dueDate: z.string().min(1, "La fecha de vencimiento es requerida"),
    minimumPayment: z.string().optional(),
    notes: z.string().optional(),
})

type BillChargesFormValues = z.infer<typeof billChargesSchema>

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
    const { serverDate, dateString, year } = useServerDate()
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const form = useForm<BillChargesFormValues>({
        resolver: zodResolver(billChargesSchema),
        defaultValues: {
            periodYear: year ?? new Date().getFullYear(),
            periodMonth: String(serverDate ? serverDate.getMonth() + 1 : new Date().getMonth() + 1),
            cutOffDate: dateString || new Date().toISOString().split('T')[0],
            dueDate: (() => {
                const date = serverDate ? new Date(serverDate) : new Date()
                date.setMonth(date.getMonth() + 1)
                return date.toISOString().split('T')[0]
            })(),
            minimumPayment: '',
            notes: '',
        },
    })

    const loading = form.formState.isSubmitting

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

    const handleSubmit = async (data: BillChargesFormValues) => {
        if (!data.cutOffDate || !data.dueDate) {
            toast.error('Las fechas son requeridas')
            return
        }

        try {
            await treasuryApi.billUnbilledCharges({
                card_account: cardAccountId,
                period_year: data.periodYear,
                period_month: parseInt(data.periodMonth),
                cut_off_date: data.cutOffDate,
                due_date: data.dueDate,
                minimum_payment: data.minimumPayment ? parseFloat(data.minimumPayment) : undefined,
                notes: data.notes ?? '',
            })
            onSuccess()
        } catch (error) {
            showApiError(error, 'Error al facturar cargos')
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
            <form id="bill-charges-form" onSubmit={form.handleSubmit(handleSubmit)}>
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
                                            <Button
                                                variant="ghost"
                                                type="button"
                                                onClick={() => toggleGroup(key)}
                                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors shadow-none text-foreground"
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
                                            </Button>

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
                            {...form.register("periodYear", { valueAsNumber: true })}
                            required
                        />
                        {form.formState.errors.periodYear && (
                            <p className="text-xs text-destructive">{form.formState.errors.periodYear.message}</p>
                        )}
                        <LabeledSelect
                            label="Mes"
                            options={MONTHS}
                            value={form.watch("periodMonth")}
                            onChange={(v) => form.setValue("periodMonth", v)}
                            placeholder="Seleccionar mes"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Fecha de Cierre"
                            type="date"
                            {...form.register("cutOffDate")}
                            required
                        />
                        <LabeledInput
                            label="Fecha de Vencimiento"
                            type="date"
                            {...form.register("dueDate")}
                            required
                        />
                    </div>
                    <LabeledInput
                        label="Pago Mínimo (opcional)"
                        type="number"
                        step="1"
                        min="0"
                        {...form.register("minimumPayment")}
                        placeholder="0"
                    />
                    <LabeledInput
                        label="Notas (opcional)"
                        as="textarea"
                        rows={3}
                        {...form.register("notes")}
                        placeholder="Notas sobre la facturación"
                    />
                </div>
            </form>
        </BaseModal>
    )
}
