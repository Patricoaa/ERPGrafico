import type { Task } from "../api/workflowApi"

/**
 * Documento que abre una tarea de la bandeja (ADR-0083: ficha documental en lugar del Order
 * Hub). `null` = la tarea no abre un documento (la maneja su propio flujo).
 */
export function documentForTask(task: Task): { label: string; id: number } | null {
    const id = task.object_id
    if (!id) return null
    const type = task.task_type ?? ""
    const data = (task.data ?? {}) as Record<string, unknown>

    if (type === "OT_CREATION") {
        // OT_CREATION is the material-assignment task: the operator works inside the work order.
        return { label: "production.workorder", id }
    }
    if (type.includes("OT_")) return { label: "production.workorder", id }
    if (type.includes("OC_")) return { label: "purchasing.purchaseorder", id }
    if (type.includes("OV_")) return { label: "sales.saleorder", id }
    if (type.includes("NC_") || type.includes("ND_")) return { label: "billing.invoice", id }
    if (type.startsWith("HUB_")) {
        if (data.is_invoice) return { label: "billing.invoice", id }
        return { label: data.order_type === "purchase" ? "purchasing.purchaseorder" : "sales.saleorder", id }
    }
    return null
}
