"use client"

import { formatCurrency } from "@/lib/money"
import { Section } from "@/components/shared"

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
        <Section className="ml-auto w-full max-w-xs rounded-md border px-4">
            <Section.Row variant="stat" title="Subtotal (neto)" value={formatCurrency(subtotal)} />
            <Section.Row variant="stat" title="IVA" value={formatCurrency(tax)} />
            <Section.Row variant="stat" strong title="Total" value={formatCurrency(total)} />
            <Section.Row variant="stat" title="Pagado" value={formatCurrency(paid)} />
            <Section.Row variant="stat" strong={pending > 0} title="Saldo pendiente" value={formatCurrency(pending)} />
        </Section>
    )
}

export const toNumber = (value: unknown) => {
    const n = parseFloat(String(value ?? 0))
    return Number.isFinite(n) ? n : 0
}
