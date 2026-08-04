import { createEntityFields } from "@/components/shared"
import { DataCell } from "@/components/shared"
import type { InventoryDocument } from "./types"

const DOCUMENT_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral" | "info" | "primary", label: string }> = {
    'RECEIPT': { intent: 'success', label: 'Recepción' },
    'DELIVERY': { intent: 'primary', label: 'Entrega' },
    'TRANSFER': { intent: 'info', label: 'Transferencia' },
    'ADJUSTMENT': { intent: 'warning', label: 'Ajuste' },
    'PRODUCTION': { intent: 'neutral', label: 'Producción' }
}

export const inventoryDocumentFields = createEntityFields<InventoryDocument>()({
    folio: {
        key: "id",
        type: "code",
        label: "Folio",
        get: (d) => `DOC-${d.id}`,
    },
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
        get: (d) => DOCUMENT_TYPE_MAP[d.document_type]?.label ?? d.document_type,
        intent: (d) => DOCUMENT_TYPE_MAP[d.document_type]?.intent ?? 'neutral',
    },
    reference: {
        key: "reference",
        type: "computed",
        label: "Referencia",
        render: (d) => {
            if (d.source_document_type && d.source_document_id) {
                return <DataCell.Entity entityLabel={d.source_document_type} number={d.source_document_id} />
            }
            return <DataCell.Text>{d.reference || '-'}</DataCell.Text>
        },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        tableOptions: { width: 100 },
    },
})
