/** Contract of `GET /inventory/products/{id}/production-analysis/`. */
import type { SalesImpactGranularity } from "./salesImpact.types"
import type { UsedIn } from "./sourcing.types"

export type IncreasePct = 5 | 10 | 20

export interface ProductionAnalysisParams {
    granularity: SalesImpactGranularity
    increase_pct: IncreasePct
    date_from?: string
    date_to?: string
}

export interface MadeKpis {
    orders: number
    units: number
    rectified: number
    /** Rectified ÷ orders × 100. */
    rectification_rate: number
    previous: { orders: number; units: number } | null
}

export interface MadePoint {
    period: string
    orders: number
    units: number
}

export interface MadeMaterial {
    component_id: number
    name: string
    planned_qty: number
    consumed_qty: number
    deviation_qty: number
    /** `null` without planned quantity. */
    deviation_pct: number | null
}

export interface MadeOrder {
    id: number
    number: string
    date: string
    units: number
    rectified: boolean
}

export interface ProductionMade {
    kpis: MadeKpis
    series: { points: MadePoint[]; previous_points: MadePoint[] }
    materials: MadeMaterial[]
    orders: MadeOrder[]
}

export interface InputPoint {
    period: string
    consumed: number
}

export interface InputByProduct {
    product_id: number | null
    name: string
    qty: number
    share_pct: number
}

export interface ProductionInput {
    kpis: { consumed: number; orders: number; previous: { consumed: number; orders: number } | null }
    series: { points: InputPoint[]; previous_points: InputPoint[] }
    by_product: InputByProduct[]
    /** Same payload as `sourcing.used_in`. */
    used_in: UsedIn
}

export interface ProductProductionAnalysis {
    /** Only for manufactured products. */
    made: ProductionMade | null
    /** Only for products used in production. */
    input: ProductionInput | null
}
