"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { Chip } from "@/components/shared"
import { Settings2, Zap, Package, CheckCircle2, AlertCircle } from "lucide-react"
import type { SaleOrderLine } from "../types"

export interface ManufacturableLine extends SaleOrderLine {
    originalIndex: number
}

export function getMfgLineSubType(line: SaleOrderLine): 'SIMPLE' | 'EXPRESS' | 'ADVANCED' {
    if (line.requires_advanced_manufacturing) return 'ADVANCED'
    if (line.mfg_auto_finalize) return 'EXPRESS'
    return 'SIMPLE'
}

// ─── mfgLineProduct: name + code chips ───────────────────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        mfgLineProduct: { value: { name: string; internalCode?: string; code?: string } | null; options: Record<never, never> }
    }
}

function MfgLineProductCell({ value }: ValueRenderProps<"mfgLineProduct">) {
    if (!value) return null
    return (
        <div className="flex flex-col gap-1">
            <span className="font-bold text-xs leading-tight text-foreground/90">{value.name}</span>
            <div className="flex flex-wrap gap-1">
                {value.internalCode && (
                    <Chip size="xs" intent="primary" className="font-mono">{value.internalCode}</Chip>
                )}
                {value.code && value.code !== value.internalCode && (
                    <Chip size="xs" intent="neutral" className="font-mono">{value.code}</Chip>
                )}
            </div>
        </div>
    )
}

registerValueKind("mfgLineProduct", {
    format: (v) => v?.name ?? "",
    render: MfgLineProductCell,
})

// ─── mfgLineSubtype: SIMPLE / EXPRESS / ADVANCED chips ───────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        mfgLineSubtype: { value: 'SIMPLE' | 'EXPRESS' | 'ADVANCED' | null; options: Record<never, never> }
    }
}

function MfgLineSubtypeCell({ value }: ValueRenderProps<"mfgLineSubtype">) {
    if (!value) return null
    if (value === 'ADVANCED') return <Chip size="sm" intent="primary" icon={Settings2}>Avanzada</Chip>
    if (value === 'EXPRESS') return <Chip size="sm" intent="info" icon={Zap}>Express</Chip>
    return <Chip size="sm" intent="neutral" icon={Package}>Simple</Chip>
}

registerValueKind("mfgLineSubtype", {
    format: (v) => v ?? "",
    render: MfgLineSubtypeCell,
})

// ─── mfgLineStatus: configured / pending / auto-finalized / available ─────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        mfgLineStatus: { value: { subtype: 'SIMPLE' | 'EXPRESS' | 'ADVANCED'; hasConfig: boolean } | null; options: Record<never, never> }
    }
}

function MfgLineStatusCell({ value }: ValueRenderProps<"mfgLineStatus">) {
    if (!value) return null
    const { subtype, hasConfig } = value
    if (subtype === 'ADVANCED') {
        return hasConfig
            ? <Chip size="sm" intent="success" icon={CheckCircle2}>Configurado</Chip>
            : <Chip size="sm" intent="warning" icon={AlertCircle}>Pendiente</Chip>
    }
    if (subtype === 'EXPRESS') return <Chip size="sm" intent="info" icon={Zap}>Auto-Finalizado</Chip>
    return <Chip size="sm" intent="success" icon={CheckCircle2}>Disponible</Chip>
}

registerValueKind("mfgLineStatus", {
    format: (v) => {
        if (!v) return ""
        if (v.subtype === 'ADVANCED') return v.hasConfig ? "Configurado" : "Pendiente"
        if (v.subtype === 'EXPRESS') return "Auto-Finalizado"
        return "Disponible"
    },
    render: MfgLineStatusCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

const fixed = { sortable: false } as const

export const mfgDetailLineEntity = defineEntity<ManufacturableLine>()((f) => ({
    title: "Detalles de fabricación",
    rowId: (r) => r.originalIndex,
    fields: {
        product: f.value("mfgLineProduct", (r) => ({
            name: r.product_name || r.description,
            internalCode: r.internal_code,
            code: r.code,
        }), { ...fixed, label: "Producto" }),
        name: f.text((r) => r.product_name || r.description || "", { ...fixed, label: "Producto" }),
        code: f.text((r) => r.internal_code || r.code || "", { ...fixed, label: "Código" }),
        qty: f.number((r) => r.qty ?? r.quantity, { ...fixed, label: "Cantidad" }),
        subtype: f.value("mfgLineSubtype", getMfgLineSubType, { ...fixed, label: "Tipo" }),
        status: f.value("mfgLineStatus", (r) => ({
            subtype: getMfgLineSubType(r),
            hasConfig: !!r.manufacturing_data,
        }), { ...fixed, label: "Estado" }),
    },
}))

const SUBTYPE_ICON = { ADVANCED: Settings2, EXPRESS: Zap, SIMPLE: Package } as const
const SUBTYPE_LABEL = { ADVANCED: "Avanzada", EXPRESS: "Express", SIMPLE: "Simple" } as const

export const mfgDetailLineViews = mfgDetailLineEntity.views({
    table: { columns: ["product", "qty", "subtype", "status"] },
    card: {
        title: "name",
        subtitle: ["code"],
        meta: ["qty", "status"],
        media: {
            placement: "top",
            iconFor: (r) => SUBTYPE_ICON[getMfgLineSubType(r)],
            // Advanced lines wait for their configuration; everything else needs nothing from the operator.
            tone: (r) => (getMfgLineSubType(r) === "ADVANCED" ? (r.manufacturing_data ? "success" : "warning") : "default"),
            badge: (r) => SUBTYPE_LABEL[getMfgLineSubType(r)],
        },
    },
})
