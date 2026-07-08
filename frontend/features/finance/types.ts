import type { ReportNode } from '@/components/shared'

export interface BalanceSheetData {
    total_assets: number
    total_liabilities: number
    total_equity: number
    assets: ReportNode[]
    liabilities: ReportNode[]
    equity: ReportNode[]
    total_assets_comp?: number
    total_liabilities_comp?: number
    total_equity_comp?: number
    check?: number
    check_comp?: number
}

export interface PLSection {
    name: string
    is_total: boolean
    total: number
    total_comp?: number
    tree: ReportNode[]
}

export interface PLData {
    sections: PLSection[]
}
