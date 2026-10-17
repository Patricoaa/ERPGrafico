"use client"

import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * Recuadro de totales bajo la tabla de productos de la ficha documental (ADR-0083):
 * Subtotal (Σ subtotales netos de la tabla), IVA, Total · Pagado, Saldo pendiente.
 * Alineado a la derecha; mismo bloque en OV, OC y facturas.
 */
export function DocumentTotalsBox({ subtotal, tax, total, paid, pending }: {
    subtotal: number
    tax: number
    total: number
    paid: number
    pending: number
}) {
    return (
        <dl className="ml-auto w-full max-w-xs space-y-1.5 rounded-md border px-4 py-3 text-xs tabular-nums">
            <TotalRow label="Subtotal (neto)" value={subtotal} />
            <TotalRow label="IVA" value={tax} />
            <TotalRow label="Total" value={total} strong />
            <div className="border-t pt-1.5" />
            <TotalRow label="Pagado" value={paid} />
            <TotalRow label="Saldo pendiente" value={pending} strong={pending > 0} />
        </dl>
    )
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("font-medium", strong && "font-bold text-foreground")}>{formatCurrency(value)}</dd>
        </div>
    )
}

export const toNumber = (value: unknown) => {
    const n = parseFloat(String(value ?? 0))
    return Number.isFinite(n) ? n : 0
}
