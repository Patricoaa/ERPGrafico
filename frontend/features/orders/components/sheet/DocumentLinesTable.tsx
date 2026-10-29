"use client"

import { Collection, useEntityCollection } from "@/components/entity-view"
import { orderLineEntity, orderLineViews } from "../../entity-view/orderLine.entity"
import { OrderLineActionsProvider } from "./OrderLineActionsContext"
import type { OrderLine } from "../../types"

interface DocumentLinesTableProps {
    lines: OrderLine[]
    kind: keyof typeof orderLineViews
    onCreateWorkOrder?: (line: OrderLine) => void
}

/** Products of a document sheet (OV, OC, invoice): read-only, every line on one page. */
export function DocumentLinesTable({ lines, kind, onCreateWorkOrder }: DocumentLinesTableProps) {
    const collection = useEntityCollection(orderLineEntity, { rows: lines }, { pagination: { mode: "none" } })

    return (
        <OrderLineActionsProvider onCreateWorkOrder={onCreateWorkOrder}>
            <Collection.Root collection={collection} label={kind === "invoice" ? "Productos del documento" : "Productos de la orden"}>
                <Collection.View table={orderLineViews[kind]} emptyTitle="Sin productos" emptyDescription="El documento no tiene líneas." />
            </Collection.Root>
        </OrderLineActionsProvider>
    )
}
