import { createEntityActions } from '@/components/shared'
import type { DistributionPartnerRow } from '../entity-view/distributionPartner.entity'

export interface DistributionPartnerActionsCtx {
    /** Abre la ficha del socio; sin él la acción no se ofrece (p. ej. dentro de la propia ficha). */
    onViewPartner?: (partnerId: number) => void
    /** Abre la distribución; sin él la acción no se ofrece (p. ej. dentro de la propia distribución). */
    onViewDistribution?: (distributionId: number) => void
    /** Abre el pago de dividendos; solo cuando la resolución ya está ejecutada. */
    onPayDividends?: () => void
}

/** Acciones de una fila del reparto por socio, según dónde se muestre la tabla. */
export const distributionPartnerActions = createEntityActions<DistributionPartnerRow, DistributionPartnerActionsCtx>((row, ctx) => [
    {
        action: "detail",
        label: "Ver socio",
        onClick: () => row.partnerId != null && ctx.onViewPartner?.(row.partnerId),
        visible: row.partnerId != null && !!ctx.onViewPartner,
    },
    {
        action: "detail",
        label: "Ver distribución",
        onClick: () => row.resolution && ctx.onViewDistribution?.(row.resolution.id),
        visible: !!row.resolution && !!ctx.onViewDistribution,
    },
    {
        action: "pay",
        label: "Pagar dividendos",
        onClick: () => ctx.onPayDividends?.(),
        visible: !!ctx.onPayDividends && row.dividend > 0,
    },
])
