import { defineEntity, formatDate, type StatusValue } from "@/components/entity-view"
import type { RcvApiKey } from "../types/rcv"

function localDateISO(now: Date): string {
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${now.getFullYear()}-${month}-${day}`
}

/** "Sin cupo hasta {fecha}" solo si `exhausted_until` es hoy o posterior (fecha local); si no, cadena vacía. */
export function rcvKeyExhaustion(apiKey: Pick<RcvApiKey, "exhausted_until">, now: Date = new Date()): string {
    const until = apiKey.exhausted_until
    if (!until || until.slice(0, 10) < localDateISO(now)) return ""
    return `Sin cupo hasta ${formatDate(until)}`
}

export function rcvApiKeyActive(apiKey: Pick<RcvApiKey, "is_active">): StatusValue {
    return apiKey.is_active
        ? { status: "active", label: "Activa", intent: "success" }
        : { status: "inactive", label: "Inactiva", intent: "neutral" }
}

const fixed = { sortable: false } as const

/** API keys de SimpleAPI. La key completa nunca llega al cliente: solo `masked_key`. */
export const rcvApiKeyEntity = defineEntity<RcvApiKey>()((f) => ({
    title: "API keys de SimpleAPI",
    fields: {
        label: f.text((k) => k.label || "Sin etiqueta", { ...fixed, label: "Etiqueta" }),
        maskedKey: f.code("masked_key", { ...fixed, label: "API key" }),
        active: f.status((k) => rcvApiKeyActive(k), { ...fixed, label: "Estado" }),
        usage: f.text((k) => `${k.used_this_month}/${k.monthly_limit} este mes`, { ...fixed, label: "Consumo" }),
        exhausted: f.text((k) => rcvKeyExhaustion(k), { ...fixed, label: "Cupo" }),
        lastUsed: f.date("last_used_at", { ...fixed, label: "Último uso", time: true }),
        lastError: f.text("last_error", { ...fixed, label: "Último error", truncate: true }),
    },
}))

export const rcvApiKeyViews = rcvApiKeyEntity.views({
    table: {
        columns: ["label", "maskedKey", "active", "usage", "exhausted", "lastUsed", "lastError"],
        primary: "label",
    },
})
