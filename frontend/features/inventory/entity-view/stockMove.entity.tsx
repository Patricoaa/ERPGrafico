"use client"

import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { cn } from "@/lib/utils"
import { formatQuantity } from "@/lib/money"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RotateCcw, Package } from "lucide-react"

export interface StockMove {
    id: number
    display_id?: string
    date: string
    product_name: string
    product_internal_code?: string
    product_code?: string
    source_location: number
    source_location_name: string
    destination_location: number
    destination_location_name: string
    quantity: string
    uom_name: string
    uom_abbreviation?: string
    description: string
    direction?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'OTHER'
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        stockMoveFlow: {
            value: { source: string; dest: string } | null
            options: Record<never, never>
        }
        stockMoveQty: {
            value: { qty: number; direction: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'OTHER'; unit: string } | null
            options: Record<never, never>
        }
    }
}

registerValueKind("stockMoveFlow", {
    format: (v) => v ? `${v.source} → ${v.dest}` : "",
    sortValue: (v) => v?.source ?? null,
    render: ({ value }) =>
        value ? (
            <div className="flex flex-col max-w-[180px]">
                <span className="text-xs truncate" title={value.source}>{value.source}</span>
                <span className="text-3xs text-muted-foreground truncate">→ {value.dest}</span>
            </div>
        ) : (
            <DataCell.Empty />
        ),
    inline: ({ value }) =>
        value ? (
            <DataCell.Text inline>{value.source} → {value.dest}</DataCell.Text>
        ) : (
            <DataCell.Empty inline />
        ),
})

registerValueKind("stockMoveQty", {
    format: (v) => v ? `${formatQuantity(v.qty)} ${v.unit}` : "",
    sortValue: (v) => v?.qty ?? null,
    align: "end",
    render: ({ value, align }) => {
        if (!value) return <DataCell.Empty align={align} />
        const colorClass =
            value.direction === 'IN' ? 'text-income' :
            value.direction === 'OUT' ? 'text-expense' :
            'text-foreground'
        return (
            <span className={cn("font-mono text-xs tabular-nums", colorClass, align === "end" && "text-right block")}>
                {formatQuantity(value.qty)}{' '}
                <span className="text-muted-foreground font-normal">{value.unit}</span>
            </span>
        )
    },
    inline: ({ value }) =>
        value ? (
            <DataCell.Text inline>{formatQuantity(value.qty)} {value.unit}</DataCell.Text>
        ) : (
            <DataCell.Empty inline />
        ),
})

export const stockMoveEntity = defineEntity<StockMove>()((f) => ({
    label: "inventory.stockmove",
    fields: {
        folio: f.code(
            (m) => formatEntityDisplay('inventory.stockmove', m as unknown as Record<string, unknown>),
            { label: "Folio" },
        ),
        productName: f.text("product_name", { label: "Producto" }),
        flow: f.value(
            "stockMoveFlow",
            (m) => ({ source: m.source_location_name, dest: m.destination_location_name }),
            { label: "Origen → Destino" },
        ),
        date: f.date("date", { label: "Fecha" }),
        quantity: f.value(
            "stockMoveQty",
            (m) => ({
                qty: Math.abs(Number(m.quantity)),
                direction: m.direction ?? 'OTHER',
                unit: m.uom_abbreviation || m.uom_name,
            }),
            { label: "Cantidad" },
        ),
    },
}))

export const stockMoveViews = stockMoveEntity.views({
    table: {
        columns: ["folio", "productName", "flow", "date", "quantity"],
        primary: "productName",
    },
    card: {
        title: "folio",
        subtitle: ["productName"],
        meta: ["date", "quantity"],
        trailing: ["flow"],
        media: {
            iconFor: (m) => {
                switch (m.direction) {
                    case 'IN': return ArrowDownLeft
                    case 'OUT': return ArrowUpRight
                    case 'TRANSFER': return ArrowLeftRight
                    case 'ADJUSTMENT': return RotateCcw
                    default: return Package
                }
            },
            tone: (m) => {
                switch (m.direction) {
                    case 'IN': return 'success'
                    case 'OUT': return 'destructive'
                    case 'TRANSFER': return 'info'
                    case 'ADJUSTMENT': return 'warning'
                    default: return 'default'
                }
            },
        },
    },
})
