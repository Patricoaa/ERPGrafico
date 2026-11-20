/** Contract of `GET /inventory/products/{id}/production-performance/` (ADR-0146). */

export interface ProductionPerformanceParams {
    date_from?: string
    date_to?: string
}

export interface ProductionPerformanceKpis {
    orders: number
    unit_real_cost: number
    bom_cost: number
    bom_gap_pct: number
    deviation_pct: number
    lead_time_days: number | null
    rectification_rate: number
}

export interface ProductionOrderPerformance {
    id: number
    number: string
    date: string | null
    qty: number
    planned_cost: number
    real_cost: number | null
    deviation: number | null
    deviation_pct: number | null
    revenue: number | null
    margin: number | null
    estimated: boolean
}

export interface ProductionMaterialPerformance {
    component_id: number
    name: string
    planned_qty: number
    consumed_qty: number
    planned_cost: number
    real_cost: number
    deviation: number
}

export interface ProductionStagePerformance {
    stage: string
    label: string
    avg_days: number
    orders: number
}

export interface ProductionPerformance {
    kpis: ProductionPerformanceKpis
    orders: ProductionOrderPerformance[]
    materials: ProductionMaterialPerformance[]
    stages: ProductionStagePerformance[]
}
