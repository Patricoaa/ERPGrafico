"use client"

import { cn } from "@/lib/utils"
import { Settings2 } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { CardSurface, CardRail, cardAnatomy } from "@/components/shared"
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
    const title = hasConfig ? "Editar configuración" : "Configurar fabricación"

    return (
        <CardSurface
            role="button"
            aria-label={ariaLabel}
            title={title}
            onClick={onConfigure}
            className="flex-row items-stretch"
        >
            <div className={cardAnatomy.body}>
                <span className={cardAnatomy.code}>{code}</span>
                <h3 className={cardAnatomy.title}>{name}</h3>

                <div className={cn(cardAnatomy.footer, "flex flex-col gap-0.5")}>
                    <p className={cardAnatomy.caption}>{qty} und</p>
                    <p className={cardAnatomy.amount}>{formatCurrency(total)}</p>
                </div>
            </div>

            <CardRail tone={hasConfig ? "success" : "warning"}>
                <Settings2 className="h-5 w-5" aria-hidden />
            </CardRail>
        </CardSurface>
    )
}