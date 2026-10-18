import { defineEntity } from "@/components/entity-view"
import type { PaymentTerminalDevice } from "../types"

/** Payment method id → chip of the `payment_method` domain. */
const DEVICE_METHOD_CHIP: Record<number, string> = {
    1: "CREDIT_CARD",
    2: "DEBIT_CARD",
}

/** Payment terminal device (ADR-0087 oleada A3). Replaces terminalDeviceFields.ts + renderCard. */
export const terminalDeviceEntity = defineEntity<PaymentTerminalDevice>()((f) => ({
    label: "treasury.terminaldevice",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        providerName: f.text("provider_name", { label: "Proveedor" }),
        serialNumber: f.code("serial_number", { label: "N° Serie" }),
        supportedMethods: f.tags(
            (d) => (d.supported_payment_methods ?? []).map((id) => DEVICE_METHOD_CHIP[id]).filter((c): c is string => !!c),
            { label: "Métodos Soportados", domain: "payment_method", sortable: false },
        ),
    },
}))

export const terminalDeviceViews = terminalDeviceEntity.views({
    table: { columns: ["name", "providerName", "serialNumber", "supportedMethods"], defaultSort: "name" },
    card: { title: "name", subtitle: ["providerName", "serialNumber"], meta: ["supportedMethods"] },
})
