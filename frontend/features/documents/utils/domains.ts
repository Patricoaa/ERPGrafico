import { Banknote, BookOpen, Factory, FileText, Package, Shapes, TrendingUp, Users, Coins, type LucideIcon } from "lucide-react"
import type { DocumentDomain } from "../types"

/**
 * Presentación de las áreas operativas (ADR-0083). El área de cada tipo la decide el backend
 * (`DocumentRef.domain`); aquí solo su nombre, icono y orden, que es el del ciclo.
 */
export const DOCUMENT_DOMAIN_META: Record<DocumentDomain, { label: string; icon: LucideIcon; order: number }> = {
    origin: { label: "Origen", icon: TrendingUp, order: 0 },
    billing: { label: "Facturación", icon: FileText, order: 1 },
    production: { label: "Manufactura", icon: Factory, order: 2 },
    logistics: { label: "Logística", icon: Package, order: 3 },
    treasury: { label: "Tesorería", icon: Banknote, order: 4 },
    accounting: { label: "Contabilidad", icon: BookOpen, order: 5 },
    capital: { label: "Capital y Socios", icon: Coins, order: 6 },
    contacts: { label: "Contactos", icon: Users, order: 7 },
    other: { label: "Otros", icon: Shapes, order: 8 },
}

export const DOMAIN_ORDER = (Object.keys(DOCUMENT_DOMAIN_META) as DocumentDomain[])
    .sort((a, b) => DOCUMENT_DOMAIN_META[a].order - DOCUMENT_DOMAIN_META[b].order)
