import { defineEntity } from "@/components/entity-view"
import { docRef, type DocumentRef } from "@/features/documents"

export interface PurchaseReceiptLine {
    id: number
    product: number | null
    product_name: string | null
    quantity_received: number
    uom_name: string | null
    stock_move: number | null
    stock_move_document: DocumentRef | null
}

const fixed = { sortable: false } as const

export const purchaseReceiptLineEntity = defineEntity<PurchaseReceiptLine>()((f) => ({
    title: "Líneas de recepción",
    fields: {
        product: docRef(
            f,
            (l) => l.product ? { label: "inventory.product", id: l.product, display: l.product_name ?? "" } : null,
            { ...fixed, label: "Producto", fallback: (l) => l.product_name ?? undefined },
        ),
        quantity: f.quantity("quantity_received", { ...fixed, label: "Cantidad", uom: (l) => l.uom_name }),
        stockMove: docRef(
            f,
            (l) => l.stock_move_document
                ? { label: l.stock_move_document.label, id: l.stock_move_document.id, display: l.stock_move_document.display_id, url: l.stock_move_document.url }
                : null,
            { ...fixed, label: "Movimiento" },
        ),
    },
}))

export const purchaseReceiptLineViews = purchaseReceiptLineEntity.views({
    table: { columns: ["product", "quantity", "stockMove"] },
})
