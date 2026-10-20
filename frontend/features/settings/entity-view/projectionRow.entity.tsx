"use client"

import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, formatMoneyValue, type ValueRenderProps } from "@/components/entity-view"

export interface ProjectionRow {
    id: string
    name: string
    type: "existing" | "new"
    capital: number
    currentPerc: string
    projectedPerc: string
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        projectionRowName: { value: ProjectionRow; options: Record<never, never> }
        projectionRowCapital: { value: ProjectionRow; options: Record<never, never> }
        projectionRowProjectedPerc: { value: ProjectionRow; options: Record<never, never> }
    }
}

function ProjectionRowNameCell({ value: row }: ValueRenderProps<"projectionRowName">) {
    const isNew = row.type === "new"
    return (
        <DataCell.Text className={isNew ? "text-left justify-start text-xs font-bold text-primary" : "text-left justify-start text-xs font-semibold text-muted-foreground"}>
            {row.name}
        </DataCell.Text>
    )
}

function ProjectionRowCapitalCell({ value: row }: ValueRenderProps<"projectionRowCapital">) {
    const isNew = row.type === "new"
    return (
        <DataCell.Currency
            value={row.capital}
            weight={isNew ? "bold" : undefined}
            className={isNew ? "text-primary" : undefined}
        />
    )
}

function ProjectionRowProjectedPercCell({ value: row }: ValueRenderProps<"projectionRowProjectedPerc">) {
    const isNew = row.type === "new"
    return (
        <DataCell.Text className={`text-right text-xs font-mono${isNew ? " font-bold text-primary" : ""}`}>
            {row.projectedPerc}
        </DataCell.Text>
    )
}

let registered = false
function registerProjectionRowValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("projectionRowName", {
        format: (r) => r.name,
        sortValue: (r) => r.name,
        render: ProjectionRowNameCell,
    })
    registerValueKind("projectionRowCapital", {
        format: (r) => formatMoneyValue(r.capital),
        sortValue: (r) => r.capital,
        align: "end",
        render: ProjectionRowCapitalCell,
    })
    registerValueKind("projectionRowProjectedPerc", {
        format: (r) => r.projectedPerc,
        sortValue: (r) => r.projectedPerc,
        align: "end",
        render: ProjectionRowProjectedPercCell,
    })
}

registerProjectionRowValueKinds()

export const projectionRowEntity = defineEntity<ProjectionRow>()((f) => ({
    title: "Proyección de Participación",
    rowId: (r) => r.id,
    fields: {
        name: f.value("projectionRowName", (r) => r, { label: "Socio", sortable: false }),
        capital: f.value("projectionRowCapital", (r) => r, { label: "Capital Actual", sortable: false }),
        currentPerc: f.text("currentPerc", { label: "Actual %", sortable: false, align: "end" }),
        projectedPerc: f.value("projectionRowProjectedPerc", (r) => r, { label: "Proyectado %", sortable: false }),
    },
}))

export const projectionRowViews = projectionRowEntity.views({
    table: {
        columns: ["name", "capital", "currentPerc", "projectedPerc"],
        primary: "name",
    },
})
