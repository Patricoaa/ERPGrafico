"use client"

import { defineEntity, defineEditable, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { cn } from "@/lib/utils"
import { QuantityDisplay } from "@/components/shared"
import type { WorkOrderMaterial } from "../types"

// ─── workOrderMaterialStock: colored available-vs-planned display ─────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        workOrderMaterialStock: {
            value: { available: number; planned: number; uomName: string } | null
            options: Record<never, never>
        }
    }
}

function WorkOrderMaterialStockCell({ value }: ValueRenderProps<"workOrderMaterialStock">) {
    if (!value) return null
    const sufficient = value.available >= value.planned
    // `available` already comes in the material's planned UoM (server converts it).
    return (
        <span className={cn("tabular-nums font-medium", sufficient ? "text-success" : "text-destructive")}>
            <QuantityDisplay value={value.available} uom={value.uomName} decimals={2} className="font-sans" />
        </span>
    )
}

registerValueKind("workOrderMaterialStock", {
    format: (v) => v ? `${v.available} ${v.uomName}` : "",
    render: WorkOrderMaterialStockCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

const fixed = { sortable: false } as const

export const workOrderMaterialEntity = defineEntity<WorkOrderMaterial>()((f) => ({
    title: "Materiales",
    rowId: (m) => m.id,
    fields: {
        componentName: f.text("component_name", { ...fixed, label: "Componente" }),
        plannedQty: f.quantity("quantity_planned", { ...fixed, label: "Un. planificadas", uom: (m) => m.uom_name }),
        stockAvail: f.value("workOrderMaterialStock", (m) => ({
            available: m.stock_available ?? 0,
            planned: m.quantity_planned,
            uomName: m.uom_name,
        }), { ...fixed, label: "Un. disponibles" }),
        consumedQty: f.quantity("quantity_consumed", { ...fixed, label: "Un. consumidas", uom: (m) => m.uom_name }),
        totalCost: f.money("total_cost", { ...fixed, label: "Costo Total" }),
        source: f.status((m) => ({
            status: m.source === 'MANUAL' ? 'NEUTRAL' : 'INFO',
            label: m.source,
        }), { ...fixed, label: "Origen" }),
    },
}))

export const workOrderMaterialViews = workOrderMaterialEntity.views({
    table: { columns: ["componentName", "plannedQty", "stockAvail", "totalCost", "source"] },
})

/** Closed rectification: what was planned vs what was actually consumed. */
export const workOrderMaterialRectifiedViews = workOrderMaterialEntity.views({
    table: { columns: ["componentName", "plannedQty", "consumedQty", "totalCost"] },
})

// ─── Editable definitions (RectificationStep) ────────────────────────────────

export const stockMatEditable = defineEditable(workOrderMaterialEntity, {
    rowKey: (m) => m.id,
    context: ["componentName", "plannedQty"] as const,
    inputs: {
        actualQty: {
            kind: "quantity" as const,
            header: "Real Consumido",
            label: (m) => `Consumo real — ${m.component_name}`,
            min: 0,
            initial: (m) => m.quantity_planned,
            unit: (m) => m.uom_name,
        },
    },
    rowStatus: (m, v) => {
        const diff = v.actualQty - m.quantity_planned
        if (diff === 0) return null
        return diff > 0
            ? { status: "increased", label: "Mayor consumo", intent: "warning" as const }
            : { status: "decreased", label: "Menor consumo", intent: "success" as const }
    },
})

export const outsourcedMatEditable = defineEditable(workOrderMaterialEntity, {
    rowKey: (m) => m.id,
    context: ["componentName"] as const,
    inputs: {
        actualQty: {
            kind: "quantity" as const,
            header: "Cant. Real",
            label: (m) => `Cantidad real — ${m.component_name}`,
            min: 0,
            initial: (m) => m.quantity_planned,
        },
        actualPrice: {
            kind: "money" as const,
            header: "Precio Unit. Real",
            label: (m) => `Precio unitario real — ${m.component_name}`,
            min: 0,
            initial: (m) => parseFloat(m.unit_price ?? "0") || 0,
        },
    },
    processed: ["actualQty"] as const,
    rowStatus: (m, v) => {
        const diffQty = v.actualQty - m.quantity_planned
        const diffPrice = v.actualPrice - (parseFloat(m.unit_price ?? "0") || 0)
        if (diffQty === 0 && diffPrice === 0) return null
        return { status: "changed", label: "Modificado", intent: "warning" as const }
    },
})
