"use client"

import { cn } from "@/lib/utils"
import { Settings2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/money"
import { selectableCardClass } from "@/components/shared"
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
        <Card
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            title={title}
            className={cn(
                selectableCardClass({ selected: hasConfig }),
                "flex-row items-stretch rounded-sm gap-0 p-0"
            )}
            onClick={onConfigure}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onConfigure()
                }
            }}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 pb-3 pt-2.5">
                <span className="truncate font-mono text-3xs text-muted-foreground">{code}</span>
                <h3 className="line-clamp-2 text-left text-sm font-semibold leading-snug">{name}</h3>

                <div className="mt-auto pt-2 flex flex-col gap-0.5">
                    <p className="text-3xs text-muted-foreground">{qty} und</p>
                    <p className="font-semibold tabular-nums text-lg">{formatCurrency(total)}</p>
                </div>
            </div>

            <div
                className={cn(
                    "flex w-14 shrink-0 items-center justify-center border-l transition-colors",
                    hasConfig
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-warning/20 bg-warning/10 text-warning"
                )}
            >
                <Settings2 className="h-5 w-5" aria-hidden />
            </div>
        </Card>
    )
}