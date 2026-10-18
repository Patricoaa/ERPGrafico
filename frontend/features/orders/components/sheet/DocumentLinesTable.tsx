"use client"

import { Collection, useEntityCollection } from "@/components/entity-view"
import { orderLineEntity, orderLineViews } from "../../entity-view/orderLine.entity"
import type { OrderLine } from "../../types"

/** Products of a document sheet (OV, OC, invoice): read-only, every line on one page. */
export function DocumentLinesTable({ lines, kind }: { lines: OrderLine[]; kind: keyof typeof orderLineViews }) {
    const collection = useEntityCollection(orderLineEntity, { rows: lines }, { pagination: { mode: "none" } })
    return (
        <Collection.Root collection={collection} label={kind === "invoice" ? "Productos del documento" : "Productos de la orden"}>
            <Collection.View table={orderLineViews[kind]} emptyTitle="Sin productos" emptyDescription="El documento no tiene líneas." />
        </Collection.Root>
    )
}
