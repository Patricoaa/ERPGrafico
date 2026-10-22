"use client"

import { cn } from "@/lib/utils"
import { Settings2, Factory, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { resolveMediaUrl } from "@/lib/media-url"
import type { ManufacturableLine } from "../../utils/mfgLine"

interface MfgLineCardProps {
    line: ManufacturableLine
    onConfigure: () => void
}

export function MfgLineCard({ line, onConfigure }: MfgLineCardProps) {
    const hasConfig = !!line.manufacturing_data
    const productObj = typeof line.product === 'object' && line.product !== null ? line.product : undefined
    resolveMediaUrl(productObj?.image_thumbnail)

    return (
        <div className={cn(
            "flex items-stretch rounded-lg border border-border bg-card transition-all",
            "hover:border-primary/40 hover:shadow-md"
        )}>
            <div className="flex-1 p-3 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="truncate font-mono text-3xs text-muted-foreground">
                        {line.internal_code ?? line.code ?? ""}
                    </span>
                    <Chip
                        size="xs"
                        intent={hasConfig ? "success" : "warning"}
                        icon={hasConfig ? CheckCircle2 : AlertCircle}
                        className="shrink-0"
                    >
                        {hasConfig ? "Configurado" : "Pendiente"}
                    </Chip>
                </div>

                <h3 className="text-sm font-semibold leading-snug truncate mb-1">
                    {line.product_name ?? line.description}
                </h3>

                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground mb-2">
                    <Factory className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                        Fabricación avanzada · {line.qty ?? line.quantity ?? 0} und
                    </span>
                </div>

                <div className="flex items-end justify-between gap-2 pt-2">
                    <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(line.total_gross ?? 0)}
                    </span>
                </div>
            </div>

            <div className="relative w-16 shrink-0 border-l border-border flex items-center justify-center bg-muted/30">
                <Button
                    variant={hasConfig ? "ghost" : "outline"}
                    size="icon"
                    className={cn(
                        "h-10 w-10 rounded-md",
                        hasConfig ? "text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-card"
                    )}
                    onClick={onConfigure}
                    aria-label={`Configurar fabricación de ${line.product_name ?? line.description}`}
                >
                    <Settings2 className="h-4 w-4" aria-hidden />
                </Button>
            </div>
        </div>
    )
}