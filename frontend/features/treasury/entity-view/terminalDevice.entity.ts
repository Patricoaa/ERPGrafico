import { defineEntity } from "@/components/entity-view"
import type { PaymentTerminalDevice } from "../types"

/** Payment terminal device (ADR-0087 oleada A3). Replaces terminalDeviceFields.ts + renderCard. */
export const terminalDeviceEntity = defineEntity<PaymentTerminalDevice>()((f) => ({
    label: "treasury.terminaldevice",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        providerName: f.text("provider_name", { label: "Proveedor" }),
        serialNumber: f.code("serial_number", { label: "N° Serie" }),
        supportedMethods: f.tags(
            (d) => d.supported_payment_method_types ?? [],
            { label: "Métodos Soportados", domain: "payment_method", sortable: false },
        ),
    },
    // ADR-0158 §3, client mode: the server searches, the browser sorts.
    query: {
        search: { placeholder: "Buscar terminal de cobro…" },
        sort: { fields: ["name", "providerName", "serialNumber"], default: "name" },
        groupBy: { fields: ["providerName"] },
        views: [{ id: "all", label: "Todos" }],
    },
}))

export const terminalDeviceViews = terminalDeviceEntity.views({
    table: { columns: ["name", "providerName", "serialNumber", "supportedMethods"] },
    card: { title: "name", subtitle: ["providerName", "serialNumber"], meta: ["supportedMethods"] },
})
