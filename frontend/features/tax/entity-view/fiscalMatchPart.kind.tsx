"use client"

import {
    registerValueKind,
    type Accessor,
    type FieldBuilders,
    type FieldDef,
    type FieldMeta,
    type ValueRenderProps,
} from "@/components/entity-view"
import { StatusBadge } from "@/components/shared"
import { PART_STATE_LABELS, partStateValue, type PartState } from "@/lib/fiscal-match"

/** Una parte (ERP, TUU o RCV) de un grupo de cuadre: su estado y un texto corto («Folio 88213»). */
export interface FiscalMatchPartValue {
    state: PartState
    text: string | null
}

/**
 * Extensión de la feature (ADR-0087 §3): la parte se lee como `StatusBadge` + texto, el mismo
 * vocabulario en tabla, card y exportación. Solo la usa `fiscalMatch.entity.ts`.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        fiscalMatchPart: { value: FiscalMatchPartValue; options: Record<never, never> }
    }
}

const formatPart = (v: FiscalMatchPartValue): string => {
    const label = PART_STATE_LABELS[v.state]
    return v.text ? `${label} · ${v.text}` : label
}

/** Solo contenido de frase (`span`): también sirve dentro del botón de la celda principal. */
function FiscalMatchPartCell({ value }: ValueRenderProps<"fiscalMatchPart">) {
    const badge = partStateValue(value.state)
    return (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5" title={value.text ?? undefined}>
            <StatusBadge status={badge.status} label={badge.label} intent={badge.intent} size="sm" className="shrink-0" />
            {value.text && <span className="min-w-0 truncate text-xs">{value.text}</span>}
        </span>
    )
}

let registered = false

/** Idempotente; se ejecuta al evaluarse el módulo (la única vía al constructor). */
export function registerFiscalMatchValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("fiscalMatchPart", {
        format: formatPart,
        sortValue: (v) => formatPart(v),
        shrink: true,
        render: FiscalMatchPartCell,
        inline: FiscalMatchPartCell,
    })
}

registerFiscalMatchValueKinds()

/** Constructor del campo: un campo `fiscalMatchPart` no existe sin su kind registrado (A1). */
export function fiscalMatchPart<T>(
    f: FieldBuilders<T>,
    accessor: Accessor<T, FiscalMatchPartValue>,
    input: FieldMeta,
): FieldDef<T, "fiscalMatchPart"> {
    return f.value("fiscalMatchPart", accessor, input)
}
