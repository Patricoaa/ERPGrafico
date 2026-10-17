"use client"

import { Button } from "@/components/ui/button"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import type { OrderLine } from "../../types"

/**
 * Enlaces de una línea de OV/OC a la ficha del producto y de la OT (ADR-0083). Se abren con
 * `openEntity`, apilados sobre la OV: el Drawer muestra "Volver a OV-…".
 */
export function OrderLineProductLink({ line }: { line: OrderLine }) {
    const { openEntity } = useGlobalModals()
    const name = line.product_name || line.description || "—"
    const productId = Number(line.product ?? line.product_id) || null
    if (!productId) return <span className="text-xs font-medium">{name}</span>
    return (
        <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-left text-xs font-medium whitespace-normal"
            onClick={() => openEntity("inventory.product", productId, undefined, undefined, { display: name })}
        >
            {name}
        </Button>
    )
}

export function OrderLineWorkOrderLink({ line }: { line: OrderLine }) {
    const { openEntity } = useGlobalModals()
    const summary = line.work_order_summary
    if (!summary?.id) return <span className="text-xs text-muted-foreground">—</span>
    const display = String(summary.display_id ?? summary.number ?? `OT-${summary.id}`)
    return (
        <Button
            variant="link"
            size="sm"
            className="h-auto p-0 font-mono text-xs font-medium"
            onClick={() => openEntity("production.workorder", Number(summary.id), undefined, undefined, { display })}
        >
            {display}
        </Button>
    )
}
