"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import { DocumentRefLink } from "@/features/documents"
import type { InventoryDocument } from "../types"

const DOCUMENT_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral" | "info" | "primary", label: string }> = {
    'RECEIPT': { intent: 'success', label: 'Recepción' },
    'DELIVERY': { intent: 'primary', label: 'Entrega' },
    'TRANSFER': { intent: 'info', label: 'Transferencia' },
    'ADJUSTMENT': { intent: 'warning', label: 'Ajuste' },
    'PRODUCTION': { intent: 'neutral', label: 'Producción' },
    'PARTNER_CONTRIBUTION': { intent: 'success', label: 'Aporte de socio' },
    'PARTNER_WITHDRAWAL': { intent: 'warning', label: 'Retiro de socio' },
}

/**
 * Feature extension: the document's own reference, which is one of three things depending on
 * what the backend sent — a full `DocumentRef` (ADR-0080, preferred — carries `accessible`/`url`),
 * an entity label + id with no full ref, or plain text. `docRef` (features/documents) does not fit:
 * its value is a client-built `{label, id, display}`, not a raw backend `DocumentRef`. Single
 * consumer → lives with its entity.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        inventoryDocRef: { value: InventoryDocument; options: Record<never, never> }
    }
}

function InventoryDocRefCell({ value: doc }: ValueRenderProps<"inventoryDocRef">) {
    if (doc.source_document) {
        return <DocumentRefLink documentRef={doc.source_document} />
    }
    if (doc.source_document_type && doc.source_document_id) {
        return <DataCell.Entity entityLabel={doc.source_document_type} number={doc.source_document_id} />
    }
    return <DataCell.Text>{doc.reference || '-'}</DataCell.Text>
}

let registered = false
function registerInventoryDocumentValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("inventoryDocRef", {
        format: (d) => d.reference || "",
        render: InventoryDocRefCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerInventoryDocumentValueKinds()

/** Inventory documents (ADR-0087 oleada B3). Replaces inventoryDocumentFields.tsx (1 computed). */
export const inventoryDocumentEntity = defineEntity<InventoryDocument>()((f) => ({
    label: "inventory.inventorydocument",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        date: f.date("date", { label: "Fecha" }),
        documentType: f.status((d) => ({
            status: d.document_type,
            label: DOCUMENT_TYPE_MAP[d.document_type]?.label ?? d.document_type,
            intent: DOCUMENT_TYPE_MAP[d.document_type]?.intent ?? "neutral",
        }), { label: "Tipo" }),
        reference: f.value("inventoryDocRef", (d) => d, { label: "Referencia" }),
        status: f.status((d) => ({ status: d.status, label: d.status_display }), { label: "Estado" }),
    },
    // ADR-0158 §3. No `sort`: the documents endpoint has no server ordering.
    query: {
        search: { placeholder: "Buscar por folio, referencia o contacto…" },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            document_type: {
                field: "documentType",
                control: "single",
                options: [
                    { value: "RECEIPT", label: "Recepción Manual" },
                    { value: "DELIVERY", label: "Entrega Manual" },
                    { value: "TRANSFER", label: "Transferencia" },
                    { value: "ADJUSTMENT", label: "Ajuste" },
                    { value: "PRODUCTION", label: "Producción Manual" },
                    { value: "PARTNER_CONTRIBUTION", label: "Aporte de Socio" },
                    { value: "PARTNER_WITHDRAWAL", label: "Retiro de Socio" },
                ],
            },
            status: { field: "status", control: "single", options: [{ value: "DRAFT", label: "Borrador" }, { value: "APPROVED", label: "Aprobado" }, { value: "CONFIRMED", label: "Confirmado" }, { value: "CANCELLED", label: "Anulado" }] },
        },
        groupBy: { fields: ["date", "documentType", "status"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
        ],
    },
}))

export const inventoryDocumentViews = inventoryDocumentEntity.views({
    table: { columns: ["folio", "date", "documentType", "reference", "status"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "folio",
        subtitle: ["documentType", "date"],
        trailing: ["status"],
        meta: ["reference"],
    },
})
