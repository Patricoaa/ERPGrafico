import { defineEntity } from "@/components/entity-view"
import type { WorkOrderMaterial } from "../types"
import { grossFromNet } from "@/lib/vat"

/**
 * Preview of the purchase orders a work order generates for its outsourced services (read only):
 * supplier, service, quantity and gross prices at the current VAT rate.
 */
export interface OutsourcedPurchaseLine {
    key: string
    supplier: string
    service: string
    quantity: number
    unitGross: number
    totalGross: number
}

export const toOutsourcedPurchaseLines = (materials: readonly WorkOrderMaterial[], vatMultiplier: number): OutsourcedPurchaseLine[] =>
    materials.map((m, i) => {
        const unitNet = parseFloat(m.unit_price ?? "0")
        const quantity = parseFloat(String(m.quantity_planned))
        return {
            key: `${m.id ?? "m"}-${i}`,
            supplier: m.supplier_name ?? "",
            service: m.component_name ?? "",
            quantity,
            unitGross: Math.round(grossFromNet(unitNet, vatMultiplier)),
            totalGross: Math.round(grossFromNet(quantity * unitNet, vatMultiplier)),
        }
    })

export const outsourcedPurchaseEntity = defineEntity<OutsourcedPurchaseLine>()((f) => ({
    title: "Compra de servicio externo",
    rowId: (l) => l.key,
    fields: {
        supplier: f.text("supplier", { label: "Proveedor", sortable: false }),
        service: f.text("service", { label: "Servicio", sortable: false }),
        quantity: f.quantity("quantity", { label: "Cantidad", sortable: false }),
        unitGross: f.money("unitGross", { label: "P. bruto", sortable: false }),
        totalGross: f.money("totalGross", { label: "Total bruto", sortable: false }),
    },
}))

export const outsourcedPurchaseViews = outsourcedPurchaseEntity.views({
    table: { columns: ["supplier", "service", "quantity", "unitGross", "totalGross"], primary: "service" },
})
