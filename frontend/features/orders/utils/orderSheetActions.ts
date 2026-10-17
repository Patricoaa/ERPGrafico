import type { DocumentDomain, ResolvedDocumentAction } from "@/features/documents"

/** Área del tab Relaciones donde se ofrece cada categoría del registro de acciones (ADR-0083). */
export const CATEGORY_DOMAIN: Record<string, DocumentDomain> = {
    documents: "billing",
    notes: "billing",
    production: "production",
    deliveries: "logistics",
    receptions: "logistics",
    returns: "logistics",
    payments: "treasury",
}

/**
 * Acciones de "ver" del Hub: el tab Relaciones las reemplaza (lista los documentos y abre
 * cada uno en su ficha).
 */
export const SHEET_EXCLUDED_ACTIONS = new Set([
    "view-documents", "view-deliveries", "view-receptions", "view-work-orders", "payment-history",
])

/** Orden del "siguiente paso" del ciclo: la primera disponible es la acción primaria. */
export const PRIMARY_PRIORITY = [
    "complete-folio",
    "create-work-order",
    "register-delivery",
    "register-reception",
    "confirm-service-delivery",
    "invoice-by-lines",
    "register-payment",
]

export interface OrderSheetActionPlan<T> {
    primary: ResolvedDocumentAction<T> | null
    secondary: ResolvedDocumentAction<T>[]
    overflow: ResolvedDocumentAction<T>[]
    byDomain: Partial<Record<DocumentDomain, ResolvedDocumentAction<T>[]>>
}

/** Reparte las acciones resueltas entre primaria, secundarias, "Más" y áreas de Relaciones. */
export function planOrderSheetActions<T>(resolved: ResolvedDocumentAction<T>[]): OrderSheetActionPlan<T> {
    const enabled = resolved.filter((r) => !r.disabled)
    const ranked = PRIMARY_PRIORITY
        .map((id) => enabled.find((r) => r.action.id === id))
        .filter((r): r is ResolvedDocumentAction<T> => !!r)
    const primary = ranked[0] ?? null
    const secondary = ranked.slice(1)
    const inBar = new Set([primary, ...secondary].filter(Boolean).map((r) => r?.action.id))
    const overflow = resolved.filter((r) => !inBar.has(r.action.id))

    const byDomain: OrderSheetActionPlan<T>["byDomain"] = {}
    for (const r of resolved) {
        const domain = CATEGORY_DOMAIN[r.category]
        if (!domain) continue
        ;(byDomain[domain] ??= []).push(r)
    }
    return { primary, secondary, overflow, byDomain }
}
