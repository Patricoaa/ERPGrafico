"use client"

import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import { formatCurrency } from "@/lib/money"

export interface TopCustomer {
    name: string
    total_revenue: number
    total_cost: number
    total_qty: number
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        marginValue: {
            value: number | null
            options: Record<never, never>
        }
    }
}

registerValueKind("marginValue", {
    format: (v) => v != null ? formatCurrency(v) : "",
    sortValue: (v) => v,
    align: "end",
    render: ({ value, align }) => {
        if (value == null) return <DataCell.Empty align={align} />
        return (
            <DataCell.CurrencyFlow
                value={Math.abs(value)}
                direction={value >= 0 ? "inflow" : "outflow"}
                align={align}
            />
        )
    },
    inline: ({ value }) =>
        value != null ? (
            <DataCell.Text inline>{formatCurrency(value)}</DataCell.Text>
        ) : (
            <DataCell.Empty inline />
        ),
})

export const topCustomerEntity = defineEntity<TopCustomer>()((f) => ({
    title: "Top Clientes",
    fields: {
        name: f.text("name", { label: "Cliente" }),
        totalRevenue: f.money("total_revenue", { label: "Ingresos" }),
        totalCost: f.money("total_cost", { label: "Costos" }),
        margin: f.value(
            "marginValue",
            (c) => c.total_revenue - c.total_cost,
            { label: "Margen Neto" },
        ),
    },
}))

export const topCustomerViews = topCustomerEntity.views({
    table: {
        columns: ["name", "totalRevenue", "totalCost", "margin"],
        primary: "name",
    },
})
