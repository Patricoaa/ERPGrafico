import { defineEntity } from "@/components/entity-view"
import { docRef, type DocumentRef } from "@/features/documents"

export interface PurchaseReturnLine {
    id: number
    product: number | null
    product_name: string | null
    quantity_returned: number
    uom_name: string | null
    stock_move: number | null
    stock_move_document: DocumentRef | null
}

const fixed = { sortable: false } as const

export const purchaseReturnLineEntity = defineEntity<PurchaseReturnLine>()((f) => ({
    title: "Líneas de devolución de compra",
    fields: {
        product: docRef(
            f,
            (l) => l.product ? { label: "inventory.product", id: l.product, display: l.product_name ?? "" } : null,
            { ...fixed, label: "Producto", fallback: (l) => l.product_name ?? undefined },
        ),
        quantity: f.quantity("quantity_returned", { ...fixed, label: "Cantidad devuelta", uom: (l) => l.uom_name }),
        stockMove: docRef(
            f,
            (l) => l.stock_move_document
                ? { label: l.stock_move_document.label, id: l.stock_move_document.id, display: l.stock_move_document.display_id, url: l.stock_move_document.url }
                : null,
            { ...fixed, label: "Movimiento" },
        ),
    },
}))

export const purchaseReturnLineViews = purchaseReturnLineEntity.views({
    table: { columns: ["product", "quantity", "stockMove"] },
})
