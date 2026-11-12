'use client'

import React from 'react'
import { toast } from 'sonner'
import { ActionConfirmModal } from '@/components/shared'
import { formatCurrency } from '@/lib/money'
import { showApiError } from '@/lib/errors'
import type { ProfitDistribution } from '@/features/contacts'
import { useProfitDistributionMutations } from '../hooks'

export type ProfitDistributionActionRequest =
    | { kind: 'execute'; distribution: ProfitDistribution }
    | { kind: 'delete'; distribution: ProfitDistribution }

const DESTINATION_LABEL = { DIVIDEND: 'Dividendos a pagar', REINVEST: 'Reinversión (capital)', RETAINED: 'Utilidades retenidas' } as const

/** Totales por destino de las líneas (vacío si la distribución se cargó sin líneas). */
export function summarizeDestinations(distribution: ProfitDistribution) {
    const totals: Record<keyof typeof DESTINATION_LABEL, number> = { DIVIDEND: 0, REINVEST: 0, RETAINED: 0 }
    for (const line of distribution.lines ?? []) {
        if (line.destinations?.length) {
            for (const d of line.destinations) totals[d.destination] += Number(d.amount)
        } else if (line.destination) {
            totals[line.destination] += Number(line.net_amount)
        }
    }
    return (Object.keys(totals) as (keyof typeof totals)[])
        .filter((k) => totals[k] !== 0)
        .map((k) => ({ key: k, label: DESTINATION_LABEL[k], amount: totals[k] }))
}

function ExecuteImpact({ distribution }: { distribution: ProfitDistribution }) {
    const summary = summarizeDestinations(distribution)
    return (
        <div className="space-y-2 text-sm">
            <p>
                Se ejecutará la resolución del año {distribution.fiscal_year} ({distribution.display_id}).
                Se generará el asiento contable y los movimientos de cada socio. No se puede deshacer desde la interfaz.
            </p>
            {summary.length > 0 && (
                <ul className="rounded-md border divide-y">
                    {summary.map((s) => (
                        <li key={s.key} className="flex justify-between px-3 py-1.5">
                            <span>{s.label}</span>
                            <span className="tabular-nums font-medium">{formatCurrency(s.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

interface Props {
    request: ProfitDistributionActionRequest | null
    onClose: () => void
    /** Tras eliminar con éxito (p. ej. cerrar el drawer de la distribución). */
    onDeleted?: () => void
}

/** Confirmaciones del ciclo de vida de una distribución: ejecutar (con impacto) y eliminar borrador. */
export function ProfitDistributionActionModal({ request, onClose, onDeleted }: Props) {
    const { execute, remove } = useProfitDistributionMutations()
    const dist = request?.distribution

    const onConfirm = async () => {
        if (!request) return
        try {
            if (request.kind === 'execute') {
                await execute.mutateAsync(request.distribution.id)
                toast.success('Distribución ejecutada.')
            } else {
                await remove.mutateAsync(request.distribution.id)
                toast.success('Borrador eliminado.')
                onDeleted?.()
            }
        } catch (error: unknown) {
            showApiError(error, request.kind === 'execute' ? 'Error al ejecutar la distribución' : 'Error al eliminar la distribución')
            throw error
        }
    }

    return (
        <ActionConfirmModal
            open={!!request}
            onOpenChange={(open) => { if (!open) onClose() }}
            onConfirm={onConfirm}
            title={request?.kind === 'delete' ? 'Eliminar distribución' : 'Ejecutar distribución'}
            description={
                !dist ? '' :
                request?.kind === 'delete'
                    ? `¿Eliminar la distribución ${dist.display_id} del año ${dist.fiscal_year}? Aún no tiene asiento contable; se pierde el borrador.`
                    : <ExecuteImpact distribution={dist} />
            }
            variant={request?.kind === 'delete' ? 'destructive' : 'warning'}
            confirmText={request?.kind === 'delete' ? 'Eliminar' : 'Ejecutar'}
        />
    )
}
