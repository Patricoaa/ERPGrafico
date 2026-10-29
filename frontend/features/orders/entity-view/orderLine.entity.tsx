import { defineEntity, formatNumber, registerValueKind, toNumber, type StatusValue, type ValueRenderProps } from "@/components/entity-view"
import { docRef, DocumentRefLink } from "@/features/documents"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useOrderLineActions } from "../components/sheet/OrderLineActionsContext"
import type { OrderLine } from "../types"

export interface OrderLineWorkOrderValue {
    workOrderId?: number | null
    display?: string | null
    isManufacturable: boolean
    line: OrderLine
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        orderLineWorkOrder: { value: OrderLineWorkOrderValue | null; options: Record<never, never> }
    }
}

function OrderLineWorkOrderCell({ value }: ValueRenderProps<"orderLineWorkOrder">) {
    const { onCreateWorkOrder } = useOrderLineActions()

    if (!value) return <span className="text-xs text-muted-foreground">—</span>

    if (value.workOrderId) {
        return (
            <DocumentRefLink
                label="production.workorder"
                id={value.workOrderId}
                display={value.display ?? `OT-${value.workOrderId}`}
                mono={false}
            />
        )
    }

    if (value.isManufacturable) {
        if (onCreateWorkOrder) {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2 gap-1 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                    onClick={(e) => {
                        e.stopPropagation()
                        onCreateWorkOrder(value.line)
                    }}
                >
                    <Plus className="h-3 w-3" />
                    Crear OT
                </Button>
            )
        }
        return <span className="text-xs text-warning font-medium">Sin OT</span>
    }

    return <span className="text-xs text-muted-foreground">—</span>
}

registerValueKind("orderLineWorkOrder", {
    format: (v) => v?.display ?? (v?.isManufacturable ? "Sin OT" : "—"),
    render: OrderLineWorkOrderCell,
})

export const lineQty = (v: number | string | null | undefined): number => toNumber(v) ?? 0

/** Lines keep the document's own order on every surface: no sortable headers (lote 3a). */
const fixed = { sortable: false } as const

export const uomOf = (l: OrderLine) => l.uom_name ?? l.unit_name ?? null
/** Stock and capacities: whole numbers plain, fractional ones with 2 decimals ("6.671,97"). */
export const amount = (n: number) => formatNumber(n, n % 1 === 0 ? 0 : 2)

export const nameOf = (l: OrderLine) => l.product_name || l.description || `Línea ${l.id}`

/** Which lines a logistics form shows: products, services or both (`filterType` of the dispatch/receipt forms). */
export type LineTypeFilter = "PRODUCT" | "SERVICE" | "ALL"

export function matchesLineType(l: OrderLine, filter: LineTypeFilter): boolean {
    if (filter === "SERVICE") return l.product_type === "SERVICE"
    if (filter === "PRODUCT") return l.product_type !== "SERVICE"
    return true
}

/** Pending to deliver/receive: the backend value when present, otherwise ordered − done. */
export function linePending(l: OrderLine): number {
    if (l.quantity_pending !== undefined && l.quantity_pending !== null) return lineQty(l.quantity_pending)
    return lineQty(l.quantity) - lineQty(l.quantity_delivered ?? l.quantity_received)
}

/**
 * What can leave the warehouse for this line (dispatch context). `available_stock` is added by the
 * dispatch screen for the chosen warehouse; the rest comes from the order line.
 */
function availability(l: OrderLine): StatusValue | null {
    const pending = linePending(l)
    if (l.product_type === "MANUFACTURABLE" && l.requires_advanced_manufacturing) {
        const wo = l.work_order_summary
        if (!wo) return { status: "no-work-order", label: "Sin OT registrada", intent: "destructive" }
        const display = String(wo.display_id ?? wo.number ?? `OT-${wo.id}`)
        return { status: wo.status.toLowerCase(), label: `${display}${l.is_production_finished ? " · terminada" : ""}`, intent: l.is_production_finished ? "success" : "warning" }
    }
    if (l.product_type === "MANUFACTURABLE" && !l.track_inventory) {
        const can = l.manufacturable_quantity ?? 0
        return { status: "manufacturable", label: `Fabricable · ${amount(can)}`, intent: can >= pending ? "success" : "destructive" }
    }
    if (l.track_inventory) {
        if (l.available_stock === undefined) return null
        return { status: "stock", label: amount(l.available_stock), intent: l.available_stock >= pending ? "success" : "destructive" }
    }
    return { status: "available", label: "Disponible", intent: "success" }
}

/**
 * Lines of OV, OC and invoices (ADR-0087 lote 3a): one entity for every document line. `OrderLine` has
 * an index signature, so every field uses a typed accessor function. References use the documents
 * extension builder `docRef(f, …)`; a line without a product shows its name as plain text.
 */
export const orderLineEntity = defineEntity<OrderLine>()((f) => ({
    // Lines have no sheet of their own (not in ENTITY_REGISTRY): embedded collection, no default open.
    title: "Líneas",
    fields: {
        product: docRef(
            f,
            (l) => {
                const id = Number(l.product ?? l.product_id)
                return id ? { label: "inventory.product", id, display: nameOf(l) } : null
            },
            { ...fixed, label: "Producto", fallback: (l) => l.product_name || l.description || undefined },
        ),
        description: f.text((l) => nameOf(l), { ...fixed, label: "Producto" }),
        quantity: f.quantity((l) => l.quantity, { ...fixed, label: "Cantidad", uom: uomOf }),
        // OV: net computed from gross (ADR-0083); OC: unit_cost is already net.
        unitPrice: f.money((l) => l.unit_price_net ?? l.unit_cost ?? l.unit_price ?? l.price_unit, { ...fixed, label: "Precio unitario (neto)", header: "P. unit. neto" }),
        unitCost: f.money((l) => l.unit_cost, { ...fixed, label: "Costo original" }),
        delivered: f.progress(
            (l) => ({ done: lineQty(l.quantity_delivered ?? l.delivered_quantity), total: lineQty(l.quantity) }),
            { ...fixed, label: "Entregado", format: "ratio" },
        ),
        received: f.progress(
            (l) => ({ done: lineQty(l.quantity_received ?? l.received_quantity), total: lineQty(l.quantity) }),
            { ...fixed, label: "Recibido", format: "ratio" },
        ),
        receivedQty: f.quantity((l) => l.quantity_received ?? l.received_quantity ?? 0, { ...fixed, label: "Recibido", uom: uomOf }),
        invoiced: f.progress(
            (l) => ({ done: lineQty(l.quantity_invoiced), total: lineQty(l.quantity) }),
            { ...fixed, label: "Facturado", format: "ratio" },
        ),
        pending: f.quantity((l) => linePending(l), { ...fixed, label: "Pendiente", uom: uomOf }),
        availability: f.status((l) => availability(l), { ...fixed, label: "Stock" }),
        workOrder: f.value(
            "orderLineWorkOrder",
            (l) => {
                const wo = l.work_order_summary
                const isMfg = Boolean(
                    l.requires_advanced_manufacturing ||
                    l.product_type === "MANUFACTURABLE" ||
                    l.is_manufacturable ||
                    (typeof l.product === "object" && l.product !== null && (l.product as { requires_advanced_manufacturing?: boolean }).requires_advanced_manufacturing)
                )
                return {
                    workOrderId: wo?.id ? Number(wo.id) : null,
                    display: wo?.id ? String(wo.display_id ?? wo.number ?? `OT-${wo.id}`) : null,
                    isManufacturable: isMfg,
                    line: l,
                }
            },
            { ...fixed, label: "OT" },
        ),
        subtotal: f.money((l) => l.subtotal_net ?? l.subtotal, { ...fixed, label: "Subtotal (neto)", header: "Subtotal neto" }),
    },
}))

const saleTable = orderLineEntity.views({
    table: { columns: ["product", "quantity", "unitPrice", "delivered", "invoiced", "workOrder", "subtotal"] },
}).table

/** Read-only line tables of the document sheets. The totals live in `DocumentTotalsBox`, so no footer. */
export const orderLineViews = {
    sale: saleTable,
    // OC: "Recibido" and no OT column. `without("work_order_summary")` would not compile (TC-012).
    purchase: orderLineEntity.views({
        table: { columns: ["product", "quantity", "unitPrice", "received", "invoiced", "subtotal"] },
    }).table,
    invoice: saleTable.without("delivered", "invoiced"),
}
