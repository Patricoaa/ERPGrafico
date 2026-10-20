import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

export interface SaleReturnLine {
    id: number
    product: number | null
    product_name: string | null
    quantity_returned: number
    uom_name: string | null
}

const fixed = { sortable: false } as const

export const saleReturnLineEntity = defineEntity<SaleReturnLine>()((f) => ({
    title: "Líneas de devolución",
    fields: {
        product: docRef(
            f,
            (l) => l.product ? { label: "inventory.product", id: l.product, display: l.product_name ?? "" } : null,
            { ...fixed, label: "Producto", fallback: (l) => l.product_name ?? undefined },
        ),
        quantity: f.quantity("quantity_returned", { ...fixed, label: "Cantidad devuelta", uom: (l) => l.uom_name }),
    },
}))

export const saleReturnLineViews = saleReturnLineEntity.views({
    table: { columns: ["product", "quantity"] },
})
