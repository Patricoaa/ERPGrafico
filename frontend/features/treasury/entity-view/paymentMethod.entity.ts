import { ArrowRightLeft, CircleSlash, CreditCard, FileText, HandCoins, Monitor, Wallet, type LucideIcon } from "lucide-react"
import { defineEntity, type CardTone } from "@/components/entity-view"
import type { PaymentMethod } from "../types"

const METHOD_TYPE_LABELS: Record<string, string> = {
    CASH: "Efectivo Directo",
    CARD_TERMINAL: "Tarjeta (Dispositivo Integrado)",
    TRANSFER: "Transferencia Bancaria",
    DEBIT_CARD: "Tarjeta Débito Empresa",
    CREDIT_CARD: "Tarjeta Crédito Empresa",
    CHECK: "Cheque",
}

const METHOD_ICON: Record<string, LucideIcon> = {
    CASH: Wallet,
    CARD_TERMINAL: Monitor,
    TRANSFER: ArrowRightLeft,
    DEBIT_CARD: CreditCard,
    CREDIT_CARD: CreditCard,
    CHECK: FileText,
    CARD: CreditCard,
    CREDIT: HandCoins,
    OTHER: CircleSlash,
}

const METHOD_TONE: Record<string, CardTone> = {
    CASH: "success",
    CARD_TERMINAL: "info",
    TRANSFER: "primary",
    DEBIT_CARD: "warning",
    CREDIT_CARD: "warning",
    CARD: "warning",
    CREDIT: "info",
}

const usage = (m: PaymentMethod): string[] => [...(m.allow_for_sales ? ["Ventas"] : []), ...(m.allow_for_purchases ? ["Compras"] : [])]

/** Payment method (ADR-0087 oleada A3). Replaces paymentMethodFields.tsx (1 computed) + the per-type card icon. */
export const paymentMethodEntity = defineEntity<PaymentMethod>()((f) => ({
    label: "treasury.paymentmethod",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        category: f.text((m) => m.method_type_display || METHOD_TYPE_LABELS[m.method_type] || m.method_type, { label: "Categoría Operativa", tone: "secondary" }),
        treasuryAccount: f.text("treasury_account_name", { label: "Cuenta de Tesorería" }),
        usage: f.tags(usage, { label: "Disponible para", sortable: false }),
        isActive: f.status((m) => (m.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
}))

export const paymentMethodViews = paymentMethodEntity.views({
    table: { columns: ["name", "category", "treasuryAccount", "isActive", "usage"], defaultSort: "name" },
    card: {
        title: "name",
        subtitle: ["category", "treasuryAccount"],
        meta: ["usage"],
        trailing: ["isActive"],
        media: { placement: "top", iconFor: (m) => METHOD_ICON[m.method_type] ?? CreditCard, tone: (m) => METHOD_TONE[m.method_type] ?? "muted" },
    },
})
