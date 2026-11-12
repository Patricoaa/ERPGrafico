import type { TaxPeriod } from "../types"

export type F29Phase = "prior" | "payment" | "close" | "done"

export function deriveF29Phase(
    period: Pick<TaxPeriod, "status" | "declaration_summary"> | null,
): F29Phase {
    if (period?.status === "CLOSED") return "done"
    if (!period || !period.declaration_summary) return "prior"

    const { vat_to_pay, is_fully_paid } = period.declaration_summary
    const vat = Number(vat_to_pay)
    if (!Number.isFinite(vat)) return "payment"
    if (vat > 0 && !is_fully_paid) return "payment"
    return "close"
}
