import { defineEntity } from "@/components/entity-view"
import { docRef, type DocumentRef } from "@/features/documents"

export interface ContactCreditDocument {
    id: number
    date?: string | null
    number?: string | null
    display_id?: string | null
    balance: number | string
    document?: DocumentRef | null
    status?: string
    status_display?: string
    [key: string]: unknown
}

const fixed = { sortable: false } as const

export const contactCreditDocumentEntity = defineEntity<ContactCreditDocument>()((f) => ({
    title: "Documentos de crédito",
    fields: {
        date: f.date((l) => l.date ?? null, { ...fixed, label: "Fecha" }),
        number: docRef(
            f,
            (l) => l.document
                ? { label: l.document.label, id: l.document.id, display: l.document.display_id, url: l.document.url }
                : null,
            { ...fixed, label: "Número", fallback: (l) => l.display_id ?? l.number ?? undefined },
        ),
        balance: f.money((l) => Number(l.balance), { ...fixed, label: "Saldo" }),
        hub: f.hubStatus((l) => l, {
            ...fixed,
            label: "Estado",
            entity: "sales.saleorder",
            caption: (l) => ({ status: l.status ?? "", label: l.status_display ?? "" }),
        }),
    },
}))

export const contactCreditDocumentViews = contactCreditDocumentEntity.views({
    table: { columns: ["date", "number", "balance", "hub"] },
})
