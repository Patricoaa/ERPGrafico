/**
 * Client-side export utilities for financial report tables.
 * Works directly with the ReportNode tree — no backend required.
 */

import { type ReportNode } from '@/components/shared'

interface ExportOptions {
    filename: string
    periodLabel: string
    compPeriodLabel?: string
    showComparison: boolean
}

function flattenNodes(nodes: ReportNode[], depth = 0): Array<{ node: ReportNode; depth: number }> {
    return nodes.flatMap(node => [
        { node, depth },
        ...(node.children ? flattenNodes(node.children, depth + 1) : []),
    ])
}

function formatCurrency(value: number): string {
    return value.toFixed(2)
}

function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

export function exportReportToCsv(nodes: ReportNode[], options: ExportOptions): void {
    const { filename, periodLabel, compPeriodLabel, showComparison } = options

    const rows: string[] = []

    // Header
    const headers = ['Nivel', 'Código', 'Cuenta / Concepto', periodLabel]
    if (showComparison && compPeriodLabel) {
        headers.push(compPeriodLabel, 'Variación', 'Var. %')
    }
    rows.push(headers.map(escapeCsv).join(','))

    // Data rows
    const flat = flattenNodes(nodes)
    for (const { node, depth } of flat) {
        const indent = '  '.repeat(depth)
        const row = [
            String(depth + 1),
            escapeCsv(node.code ?? ''),
            escapeCsv(`${indent}${node.name}`),
            formatCurrency(node.balance),
        ]

        if (showComparison && compPeriodLabel) {
            const comp = node.comp_balance ?? 0
            const variance = node.balance - comp
            const variancePct = comp !== 0 ? ((variance / Math.abs(comp)) * 100).toFixed(1) + '%' : '-'
            row.push(formatCurrency(comp), formatCurrency(variance), variancePct)
        }

        rows.push(row.join(','))
    }

    const csvContent = '\uFEFF' + rows.join('\n') // BOM for Excel UTF-8 compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
