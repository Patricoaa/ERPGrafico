import { Building2 } from "lucide-react"
import { defineEntity } from "@/components/entity-view"
import type { PaymentTerminalProvider } from "../types"

/** Payment terminal provider (ADR-0087 oleada A3). Replaces terminalProviderFields.ts + renderCard. */
export const terminalProviderEntity = defineEntity<PaymentTerminalProvider>()((f) => ({
    label: "treasury.terminalprovider",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        supplierName: f.text("supplier_name", { label: "Contacto" }),
        receivableAccount: f.text("receivable_account_name", { label: "Cuenta Recaudación" }),
        isActive: f.status((p) => (p.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Inactivo" }), { label: "Estado" }),
    },
}))

export const terminalProviderViews = terminalProviderEntity.views({
    table: { columns: ["name", "supplierName", "receivableAccount", "isActive"], defaultSort: "name" },
    card: {
        title: "name",
        subtitle: ["supplierName"],
        meta: ["receivableAccount"],
        muted: (p) => !p.is_active,
        media: {
            placement: "top",
            icon: Building2,
            badge: (p) => (p.is_active ? undefined : "Inactivo"),
        },
    },
})
