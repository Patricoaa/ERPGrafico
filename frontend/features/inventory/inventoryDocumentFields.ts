import { createEntityFields } from "@/components/shared"
import type { InventoryDocument } from "./types"

const DOCUMENT_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral" | "info" | "primary", label: string }> = {
    'RECEIPT': { intent: 'success', label: 'Recepción' },
    'DELIVERY': { intent: 'primary', label: 'Entrega' },
    'TRANSFER': { intent: 'info', label: 'Transferencia' },
    'ADJUSTMENT': { intent: 'warning', label: 'Ajuste' },
    'PRODUCTION': { intent: 'neutral', label: 'Producción' }
}

export const inventoryDocumentFields = createEntityFields<InventoryDocument>()({
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
        tableOptions: { width: 90 },
    },
    documentType: {
        key: "document_type",
        type: "chip",
        label: "Tipo",
        cardPlacement: "detail",
        get: (d) => DOCUMENT_TYPE_MAP[d.document_type]?.label ?? d.document_type,
        intent: (d) => DOCUMENT_TYPE_MAP[d.document_type]?.intent ?? 'neutral',
    },
    reference: {
        key: "reference",
        type: "text",
        label: "Referencia",
        cardPlacement: "detail",
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        tableOptions: { width: 100 },
        cardPlacement: "header",
    },
})
