"use client"

import { Wrench } from "lucide-react"
import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell, Chip } from "@/components/shared"
import { DocumentRefLink } from "@/features/documents"
import { translateProductionStage } from "@/lib/utils"
import { isWorkOrderOverdue } from "../utils"
import type { WorkOrder } from "../types"

export type { WorkOrder }

// ─── Value kind: workOrderStatus ───────────────────────────────────────────

interface WorkOrderStatusValue {
    status: string
    label: string | null
    isOverdue: boolean
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        workOrderStatus: { value: WorkOrderStatusValue | null; options: Record<never, never> }
        workOrderSaleRef: { value: { documentRef: unknown | null } | null; options: Record<never, never> }
    }
}

registerValueKind("workOrderStatus", {
    format: (v) => v?.status ?? "",
    sortValue: (v) => v?.status ?? null,
    render: ({ value: v }) => {
        if (!v) return <DataCell.Empty />
        return (
            <div className="flex justify-center gap-1.5 items-center flex-wrap">
                <DataCell.Status status={v.status} />
                {v.isOverdue && <Chip size="sm" intent="destructive">Atrasada</Chip>}
            </div>
        )
    },
    inline: ({ value: v }) =>
        v ? <DataCell.Text inline><span>{v.label ?? v.status}</span></DataCell.Text> : <DataCell.Empty inline />,
})

registerValueKind("workOrderSaleRef", {
    format: () => "",
    sortValue: () => null,
    render: ({ value: v }) => {
        if (!v || !v.documentRef) return <DataCell.Empty />
        return <DocumentRefLink documentRef={v.documentRef} />
    },
    inline: () => <DataCell.Empty inline />,
})

// ─── Entity definition ──────────────────────────────────────────────────────

export const workOrderEntity = defineEntity<WorkOrder>()((f) => ({
    title: "Órdenes de Trabajo",
    fields: {
        number: f.code("number", { label: "Folio" }),
        saleOrderNumber: f.value(
            "workOrderSaleRef",
            (w) => ({ documentRef: w.sale_order_document ?? null }),
            { label: "OV Asociada" },
        ),
        startDate: f.date("start_date", { label: "Fecha Inicio" }),
        // stage_data.product_description is only set by the manufacturing dialog; `description` is the work order's own title.
        productDescription: f.text((w) => w.product_description || w.description || "", { label: "Descripción del Trabajo" }),
        status: f.value(
            "workOrderStatus",
            (w) => ({ status: w.status, label: null, isOverdue: isWorkOrderOverdue(w) }),
            { label: "Estado" },
        ),
        currentStage: f.text(
            (w) => translateProductionStage(w.current_stage),
            { label: "Etapa" },
        ),
        dueDate: f.date("due_date", { label: "Fecha Entrega" }),
    },
}))

export const workOrderViews = workOrderEntity.views({
    table: {
        columns: ["number", "saleOrderNumber", "startDate", "productDescription", "status", "currentStage", "dueDate"],
        primary: "productDescription",
    },
    card: {
        rail: { status: (r) => r.status, icon: Wrench },
        title: "productDescription",
        subtitle: ["number"],
        meta: ["saleOrderNumber", "currentStage", "startDate", "dueDate"],
        trailing: ["status"],
    },
})
