import { defineEntity } from "@/components/entity-view"
import type { NoteLineItem } from "@/features/notes"

const noteLineEntity = defineEntity<NoteLineItem>()((f) => ({
    title: "Línea de nota",
    rowId: (l) => String(l.lineId),
    fields: {
        product: f.text((l) => l.productName, { label: "Producto / Servicio" }),
        uom: f.text((l) => l.uomName ?? "UN", { label: "UOM" }),
        originalQty: f.quantity((l) => l.originalQuantity, { label: "Original" }),
        deliveredQty: f.quantity((l) => l.originalQuantity, { label: "Entregado" }),
    },
}))

export { noteLineEntity }
