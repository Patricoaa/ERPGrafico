// types / helpers for manufacturing lines in the POS checkout
// extracted from mfgDetailLine.entity.tsx so the step doesn't depend on entity-view

import type { SaleOrderLine } from "../types"

export interface ManufacturableLine extends SaleOrderLine {
    originalIndex: number
}

export function getMfgLineSubType(line: SaleOrderLine): 'SIMPLE' | 'EXPRESS' | 'ADVANCED' {
    if (line.requires_advanced_manufacturing) return 'ADVANCED'
    if (line.mfg_auto_finalize) return 'EXPRESS'
    return 'SIMPLE'
}