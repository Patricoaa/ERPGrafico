import { createEntityFields } from '@/components/shared'
import type { StatementChargeRow } from './types'
import { DataCell, MoneyDisplay, StatusBadge } from '@/components/shared'
import { parseDateOnly } from '@/lib/utils'

export const statementChargeFields = createEntityFields<StatementChargeRow>()({
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    descripcion: {
        key: 'reference',
        type: 'computed',
        label: 'Descripción',
        render: (item) => {
            const group = item.purchaseGroupDetail
            const inst = item.originalInstallment
            return (
                <div className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-medium">
                        {item.source === 'installment'
                            ? `Cuota #${item.installmentNumber} de ${item.totalInstallments}${inst?.partner_name ? ` — ${inst.partner_name}` : ''}`
                            : item.source === 'pending'
                                ? `${item.movementTypeDisplay || 'Cargo'}${item.reference ? `: ${item.reference}` : ''}`
                                : item.reference
                                    ? item.reference
                                    : item.movementTypeDisplay || `Movimiento #${item.originalMovement?.id}`}
                    </span>
                    {item.source === 'installment' && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">
                            {[inst?.purchase_order_display_id, item.reference].filter(Boolean).join(' — ') || inst?.partner_name}
                        </span>
                    )}
                    {item.source === 'pending' && item.date && (
                        <span className="text-[10px] text-muted-foreground">
                            {parseDateOnly(item.date).toLocaleDateString('es-CL', { year: 'numeric', month: 'long' })}
                        </span>
                    )}
                    {item.source === 'movement' && item.notes && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {item.notes}
                        </span>
                    )}
                    {group?.partner_name && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {group.partner_name}
                        </span>
                    )}
                    {group?.client_reference && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {group.client_reference}
                        </span>
                    )}
                </div>
            )
        },
    },
    cuota: {
        key: 'installmentNumber',
        type: 'computed',
        label: 'Cuota',
        render: (item) => {
            if (!item.installmentNumber || !item.totalInstallments) return null
            return (
                <div className="flex justify-center text-xs font-medium tabular-nums">
                    {item.installmentNumber}/{item.totalInstallments}
                </div>
            )
        },
    },
    amount: {
        key: 'amount',
        type: 'currency',
        label: 'Monto',
    },
    tipo: {
        key: 'movementType',
        type: 'status',
        label: 'Tipo',
        get: (r) => r.movementType ?? '',
        getLabel: (r) => r.movementTypeDisplay ?? '',
    },
})
