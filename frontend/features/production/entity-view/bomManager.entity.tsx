"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { Chip, StatusBadge, DataCell } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import type { BOM } from "../types"

export interface BOMManagerRow extends BOM {
    /** Fallback UOM from parent product when row has no yield_uom_name. */
    _fallbackUom?: string
    /** Whether this BOM belongs to the base product (vs a variant). */
    _isBase?: boolean
    /** Click handler to activate this BOM; null when already active. */
    _onToggle?: (() => void) | null
}

// ─── bomManagerName: name + optional notes subtitle ───────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        bomManagerName: { value: { name: string; notes?: string } | null; options: Record<never, never> }
    }
}

function BOMManagerNameCell({ value }: ValueRenderProps<"bomManagerName">) {
    if (!value) return null
    return (
        <div className="flex flex-col items-center py-1 text-center w-full">
            <DataCell.Text className="font-black text-xs tracking-tight uppercase leading-none">{value.name}</DataCell.Text>
            {value.notes && (
                <DataCell.Secondary className="text-3xs italic truncate max-w-[200px] mt-1">{value.notes}</DataCell.Secondary>
            )}
        </div>
    )
}

registerValueKind("bomManagerName", {
    format: (v) => v?.name ?? "",
    render: BOMManagerNameCell,
})

// ─── bomManagerVariantCtx: BASE chip or code + product name ───────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        bomManagerVariantCtx: { value: { isBase: boolean; code?: string; productName?: string } | null; options: Record<never, never> }
    }
}

function BOMManagerVariantCtxCell({ value }: ValueRenderProps<"bomManagerVariantCtx">) {
    if (!value) return null
    if (value.isBase) {
        return (
            <div className="flex items-center justify-center gap-2 w-full">
                <Chip size="xs" intent="primary">BASE</Chip>
            </div>
        )
    }
    return (
        <div className="flex items-center justify-center gap-2 w-full">
            <div className="flex flex-col items-center gap-0.5">
                <DataCell.Code>{value.code || 'VAR'}</DataCell.Code>
                <DataCell.Text className="text-3xs truncate max-w-[120px]">{value.productName}</DataCell.Text>
            </div>
        </div>
    )
}

registerValueKind("bomManagerVariantCtx", {
    format: (v) => v?.isBase ? "BASE" : (v?.code ?? ""),
    render: BOMManagerVariantCtxCell,
})

// ─── bomManagerActive: clickable status badge (activates when inactive) ───────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        bomManagerActive: { value: { active: boolean; onToggle: (() => void) | null } | null; options: Record<never, never> }
    }
}

function BOMManagerActiveCell({ value }: ValueRenderProps<"bomManagerActive">) {
    if (!value) return null
    const { active, onToggle } = value
    return (
        <div className="flex justify-center">
            <Button
                variant="ghost"
                type="button"
                onClick={() => !active && onToggle?.()}
                className={cn(
                    "h-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none",
                    !active && "hover:scale-105 transition-transform"
                )}
            >
                <StatusBadge status={active ? "active" : "inactive"} className="cursor-pointer" />
            </Button>
        </div>
    )
}

registerValueKind("bomManagerActive", {
    format: (v) => v?.active ? "Activo" : "Inactivo",
    render: BOMManagerActiveCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

const fixed = { sortable: false } as const

export const bomManagerEntity = defineEntity<BOMManagerRow>()((f) => ({
    title: `Estructuras técnicas (${getDomainConceptTitle('ldm')})`,
    rowId: (r) => String(r.id ?? r.name),
    fields: {
        name: f.value("bomManagerName", (r) => ({ name: r.name, notes: r.notes }), { ...fixed, label: getDomainConceptTitle('ldm') }),
        variantCtx: f.value("bomManagerVariantCtx", (r) => ({
            isBase: r._isBase ?? false,
            code: r.product_internal_code,
            productName: r.product_name,
        }), { ...fixed, label: "Variante / Contexto" }),
        yield: f.quantity((r) => r.yield_quantity, { ...fixed, label: "Rendimiento", uom: (r) => r.yield_uom_name ?? r._fallbackUom }),
        active: f.value("bomManagerActive", (r) => ({ active: r.active, onToggle: r._onToggle ?? null }), { ...fixed, label: "Estado" }),
        linesCount: f.text((r) => `${r.lines?.length ?? 0} ITEMS`, { ...fixed, label: "Comp." }),
        updatedAt: f.date("updated_at", { ...fixed, label: "Actualizado", time: true }),
    },
}))

export const bomManagerViews = bomManagerEntity.views({
    table: { columns: ["name", "variantCtx", "yield", "active", "linesCount", "updatedAt"] },
})
