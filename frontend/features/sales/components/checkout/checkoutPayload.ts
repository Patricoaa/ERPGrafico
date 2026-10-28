import type { SaleOrder, SaleOrderLine } from "../../types"

// Design files are File objects only while the cart lives in memory: a draft that
// went through JSON comes back with plain objects, which must not reach the payload.
export const designFilesOf = (l: SaleOrderLine): File[] => {
    const files = l.manufacturing_data?.design_files
    return Array.isArray(files) ? files.filter((f): f is File => f instanceof File) : []
}

/** Manufacturing data as JSON: the files travel apart (`line_<n>_design_<m>`). */
export const cleanManufacturingData = (l: SaleOrderLine): Record<string, unknown> | null => {
    if (!l.manufacturing_data) return null
    const rest: Record<string, unknown> = { ...l.manufacturing_data }
    delete rest.design_files
    return { ...rest, design_filenames: designFilesOf(l).map((f) => f.name) }
}

/** Once the order is confirmed its OTs exist and own the manufacturing configuration. */
export const canEditManufacturing = (order: SaleOrder | null | undefined): boolean =>
    !order || order.status === "DRAFT"

/**
 * Payload of the checkout of an existing order. `line_edits` follows the checkout's line
 * order, the same order that keys the design files.
 */
export const existingOrderPayload = (order: SaleOrder, lines: SaleOrderLine[]) => {
    if (!canEditManufacturing(order)) return { id: order.id }
    return {
        id: order.id,
        line_edits: lines.map((l) => ({ line_id: l.line_id, manufacturing_data: cleanManufacturingData(l) })),
    }
}
