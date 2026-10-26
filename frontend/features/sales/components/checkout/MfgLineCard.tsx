"use client"

import { formatCurrency } from "@/lib/money"
import { CardRowWithRail, GlyphConfigure } from "@/components/shared"
import type { ManufacturableLine } from "../../utils/mfgLine"

interface MfgLineCardProps {
    line: ManufacturableLine
    onConfigure: () => void
}

export function MfgLineCard({ line, onConfigure }: MfgLineCardProps) {
    const hasConfig = !!line.manufacturing_data
    const code = line.internal_code ?? line.code ?? ""
    const name = line.product_name ?? line.description
    const qty = line.qty ?? line.quantity ?? 0
    const total = line.total_gross ?? 0

    const ariaLabel = hasConfig
        ? `Editar fabricación de ${name}. Configurado.`
        : `Configurar fabricación de ${name}. Pendiente de configuración.`

    return (
        <CardRowWithRail
            role="button"
            aria-label={ariaLabel}
            code={code}
            title={name}
            caption={`${qty} und`}
            amount={formatCurrency(total)}
            glyph={<GlyphConfigure />}
            railTone={hasConfig ? "success" : "warning"}
            onClick={onConfigure}
        />
    )
}