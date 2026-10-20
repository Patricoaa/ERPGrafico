"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Equal } from "lucide-react"
import { DataCell, QuantityDisplay } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { cn } from "@/lib/utils"
import type { InventoryCountLine } from "../types"

export interface AugmentedCountLine extends InventoryCountLine {
    _isInProgress: boolean
    _onCommit: (lineId: number, value: number | null) => void
    _diff: number | null
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        inventoryCountLineName: { value: AugmentedCountLine; options: Record<never, never> }
        inventoryCountQtyInput: { value: AugmentedCountLine; options: Record<never, never> }
        inventoryCountDiff: { value: AugmentedCountLine; options: Record<never, never> }
    }
}

function LineNameCell({ value: row }: ValueRenderProps<"inventoryCountLineName">) {
    return (
        <div className="flex flex-col">
            <DataCell.Text>{row.product_name}</DataCell.Text>
            {row.product_internal_code && (
                <span className="text-3xs text-muted-foreground font-mono">{row.product_internal_code}</span>
            )}
        </div>
    )
}

function QtyInputCell({ value: row }: ValueRenderProps<"inventoryCountQtyInput">) {
    const { id, theoretical_qty, counted_qty, _isInProgress, _onCommit } = row
    const [localValue, setLocalValue] = useState<string>(counted_qty != null ? String(counted_qty) : "")

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value)
    }, [])

    const handleBlur = useCallback(() => {
        if (localValue === "" || localValue === "-") {
            _onCommit(id, null)
            return
        }
        const num = parseFloat(localValue)
        if (!isNaN(num)) {
            setLocalValue(String(num))
            _onCommit(id, num)
        }
    }, [localValue, id, _onCommit])

    const handleEquals = useCallback(() => {
        setLocalValue(String(theoretical_qty))
        _onCommit(id, theoretical_qty)
    }, [id, theoretical_qty, _onCommit])

    const numericValue = localValue === "" || localValue === "-" ? null : parseFloat(localValue)
    const hasDifference = numericValue !== null && numericValue !== theoretical_qty

    return (
        <div className="flex justify-center gap-1">
            <Input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="--"
                className={cn(
                    "w-24 h-8 text-center text-sm font-mono",
                    hasDifference && "border-warning bg-warning/10",
                )}
                disabled={!_isInProgress}
            />
            {_isInProgress && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleEquals}
                    title="Igualar a stock teórico"
                >
                    <Equal className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            )}
        </div>
    )
}

function DiffCell({ value: row }: ValueRenderProps<"inventoryCountDiff">) {
    const diff = row._diff
    if (diff === null)
        return <span className="text-muted-foreground text-center block">--</span>
    return (
        <div
            className={cn(
                "text-center font-medium text-sm",
                diff > 0 && "text-success",
                diff < 0 && "text-destructive",
                diff === 0 && "text-muted-foreground",
            )}
        >
            <QuantityDisplay value={diff} showSign />
        </div>
    )
}

let registered = false
function registerInventoryCountLineKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("inventoryCountLineName", {
        format: (r) => r.product_name,
        sortValue: (r) => r.product_name,
        render: LineNameCell,
    })
    registerValueKind("inventoryCountQtyInput", {
        format: (r) => r.counted_qty != null ? String(r.counted_qty) : "",
        sortValue: (r) => r.counted_qty ?? -Infinity,
        align: "center",
        render: QtyInputCell,
    })
    registerValueKind("inventoryCountDiff", {
        format: (r) => r._diff != null ? String(r._diff) : "--",
        sortValue: (r) => r._diff ?? -Infinity,
        align: "center",
        render: DiffCell,
    })
}

registerInventoryCountLineKinds()

export const inventoryCountLineEntity = defineEntity<AugmentedCountLine>()((f) => ({
    title: "Líneas de Conteo",
    rowId: (r) => r.id,
    fields: {
        code: f.code("product_code", { label: "Código", sortable: true }),
        name: f.value("inventoryCountLineName", (r) => r, { label: "Producto", sortable: false }),
        theoretical: f.quantity("theoretical_qty", { label: "Stock Teórico", sortable: true }),
        counted: f.value("inventoryCountQtyInput", (r) => r, { label: "Stock Real", sortable: false }),
        diff: f.value("inventoryCountDiff", (r) => r, { label: "Diferencia", sortable: true }),
        uom: f.text("uom_name", { label: "Unidad", sortable: false }),
    },
}))

export const inventoryCountLineViews = inventoryCountLineEntity.views({
    table: {
        columns: ["code", "name", "theoretical", "counted", "diff", "uom"],
        primary: "name",
    },
})
