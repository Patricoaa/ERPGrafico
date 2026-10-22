import { defineEntity } from "@/components/entity-view"
import type { Terminal } from "@/features/treasury"

/** Payment method type → chip of the `payment_method` domain (debit/credit collapse into CARD). */
const PAYMENT_CHIP: Record<string, string> = {
    CASH: "CASH",
    CARD: "CARD",
    CARD_TERMINAL: "CARD_TERMINAL",
    TRANSFER: "TRANSFER",
    CHECK: "CHECK",
    OTHER: "OTHER",
    DEBIT_CARD: "CARD",
    CREDIT_CARD: "CARD",
}

const paymentChips = (t: Terminal): string[] => [
    ...new Set(t.allowed_payment_methods.map((m) => PAYMENT_CHIP[m.method_type]).filter((c): c is string => !!c)),
]

/** POS terminal (ADR-0087 oleada A2). Replaces posTerminalFields.ts + renderCard. */
export const posTerminalEntity = defineEntity<Terminal>()((f) => ({
    label: "treasury.terminal",
    fields: {
        code: f.code("code", { label: "Código" }),
        name: f.text("name", { label: "Nombre" }),
        location: f.text("location", { label: "Ubicación", tone: "secondary" }),
        device: f.text((t) => t.payment_terminal_device_name || (t.payment_terminal_device ? "Vinculado" : null), { label: "Dispositivo", header: "Terminal de cobro" }),
        paymentMethods: f.tags(paymentChips, { label: "Métodos", domain: "payment_method", sortable: false }),
        isActive: f.status((t) => (t.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Inactivo" }), { label: "Estado", sortable: false }),
    },
}))

export const posTerminalViews = posTerminalEntity.views({
    table: { columns: ["code", "name", "location", "device", "paymentMethods", "isActive"], primary: "name" },
    card: {
        title: "name",
        subtitle: ["code", "location"],
        meta: ["device", "paymentMethods"],
        trailing: ["isActive"],
        // Inactive terminals read as muted (the legacy card was greyed out).
        media: { placement: "top", tone: (t) => (t.is_active ? "primary" : "muted") },
    },
})
