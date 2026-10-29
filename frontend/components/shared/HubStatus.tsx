"use client"

import React from "react"
import { ClipboardList, Package, TrendingUp, Banknote, FileText } from "lucide-react"
import { StatusBadge } from "./StatusBadge"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getEntityMetadata, getDtePrefix } from "@/lib/entity-registry"
import { getHubStatuses, getInvoiceHubStatuses, getNoteHubStatuses, stageIntent } from "@/lib/workflow-status"
import { translateStatus } from "@/lib/utils"

export interface HubStatusData {
    origin: string
    production?: string
    billing: string
    treasury: string
    logistics: string
    // Tooltips or progress values
    tooltips?: {
        origin?: string
        production?: string
        billing?: string
        treasury?: string
        logistics?: string
    }
    /** Optional progress percentages (0-100) for each stage — enables SVG ring fill */
    progress?: {
        origin?: number
        production?: number
        billing?: number
        treasury?: number
        logistics?: number
    }
}

interface HubStatusProps {
    statuses: HubStatusData
    className?: string
}

/**
 * Unified Hub Status component for Orders, Invoices, and other workflow entities.
 * Renders the canonical 5-stage workflow status indicators.
 */
export function HubStatus({ statuses, className }: HubStatusProps) {
    const { tooltips = {}, progress = {} } = statuses

    const resolveStageProgress = (status?: string, prog?: number) => {
        if (status === 'warning') return 100
        return prog
    }

    return (
        <div className={className || "flex items-center gap-2"}>
            <TooltipProvider delayDuration={0}>
                {/* 1. Origin */}
                <StatusBadge
                    variant="hub"
                    size="lg"
                    icon={TrendingUp}
                    status={statuses.origin || 'info'}
                    intent={stageIntent(statuses.origin)}
                    tooltip={tooltips.origin}
                    progress={resolveStageProgress(statuses.origin, progress.origin)}
                />

                {/* 2. Production (Optional) */}
                {statuses.production && statuses.production !== 'not_applicable' && (
                    <StatusBadge
                        variant="hub"
                        size="lg"
                        icon={ClipboardList}
                        status={statuses.production}
                        intent={stageIntent(statuses.production)}
                        tooltip={tooltips.production}
                        progress={resolveStageProgress(statuses.production, progress.production)}
                    />
                )}

                {/* 3. Billing */}
                <StatusBadge
                    variant="hub"
                    size="lg"
                    icon={FileText}
                    status={statuses.billing || 'info'}
                    intent={stageIntent(statuses.billing)}
                    tooltip={tooltips.billing}
                    progress={resolveStageProgress(statuses.billing, progress.billing)}
                />

                {/* 4. Treasury */}
                <StatusBadge
                    variant="hub"
                    size="lg"
                    icon={Banknote}
                    status={statuses.treasury || 'info'}
                    intent={stageIntent(statuses.treasury)}
                    tooltip={tooltips.treasury}
                    progress={resolveStageProgress(statuses.treasury, progress.treasury)}
                />

                {/* 5. Logistics */}
                {statuses.logistics !== 'not_applicable' && (
                    <StatusBadge
                        variant="hub"
                        size="lg"
                        icon={Package}
                        status={statuses.logistics || 'info'}
                        intent={stageIntent(statuses.logistics)}
                        tooltip={tooltips.logistics}
                        progress={resolveStageProgress(statuses.logistics, progress.logistics)}
                    />
                )}
            </TooltipProvider>
        </div>
    )
}

interface DomainHubStatusProps {
    label: string
    data: object
    className?: string
}

type HubOrderShape = {
    pending_amount?: number | string
    total?: number | string
    work_orders?: Array<{ status: string; production_progress?: number }>
    lines?: Array<{ is_manufacturable?: boolean; quantity?: number | string; quantity_delivered?: number | string; quantity_received?: number | string }>
    items?: Array<{ is_manufacturable?: boolean; quantity?: number | string; quantity_delivered?: number | string; quantity_received?: number | string }>
    production_progress?: number
    status?: string
    payment_status?: string
    [key: string]: unknown
}

type HubInvoiceShape = {
    dte_type?: string
    number?: string
    status?: string
    corrected_invoice?: { display_id?: string; number?: string }
    sale_order_number?: string
    purchase_order_number?: string
    pending_amount?: number | string
    payment_status?: string
    [key: string]: unknown
}

/**
 * Data-driven Hub Status. Calculates workflow states automatically based on entity label and data.
 */
export function DomainHubStatus({ label, data, className }: DomainHubStatusProps) {
    const meta = getEntityMetadata(label)
    if (!meta?.workflowType) return null

    let statuses: HubStatusData | undefined
    let tooltips: Record<string, string | undefined> = {}

    if (meta.workflowType === 'order') {
        const d = data as HubOrderShape
        const s = getHubStatuses(d)
        const pendingAmount = parseFloat(String(d.pending_amount || 0))
        const total = parseFloat(String(d.total || 0))
        const paidPct = total > 0 ? ((1 - (pendingAmount / total)) * 100).toFixed(0) : "0"

        const showProduction = (d.work_orders?.length || 0) > 0 || (d.lines || d.items || []).some((l) => l.is_manufacturable ?? false)
        const totalOTProgress = d.production_progress || 0

        const lines = d.lines || d.items || []
        const totalOrdered = lines.reduce((acc: number, line) => acc + (parseFloat(String(line.quantity)) || 0), 0)
        let logisticsProgress = 0
        if (totalOrdered > 0) {
            const totalProcessed = lines.reduce((acc: number, line) => acc + (parseFloat(String(line.quantity_delivered || line.quantity_received || 0)) || 0), 0)
            logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
        }

        statuses = {
            ...s,
            progress: {
                origin: d.status && d.status !== 'DRAFT' ? 100 : 0,
                production: s.production === 'warning' ? 100 : (s.productionProgress ?? totalOTProgress),
                billing: s.billing === 'success' ? 100 : 0,
                treasury: s.treasuryProgress ?? 0,
                logistics: s.logisticsProgress ?? logisticsProgress,
            }
        }

        tooltips = {
            origin: `Origen: ${translateStatus(d.status)}`,
            billing: s.billing === 'success' ? "Facturado" : "Pendiente de Facturación",
            treasury: `Tesorería: ${paidPct}% Pagado${s.hasPendingTransactions ? ' - falta N° de transacción' : ''}`,
            production: showProduction
                ? (s.production === 'warning' ? 'Producción: falta crear OT' : `Producción: ${totalOTProgress}%`)
                : undefined,
            logistics: `Logística: ${logisticsProgress}%`
        }
    } else if (meta.workflowType === 'invoice') {
        const d = data as HubInvoiceShape
        const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(d.dte_type ?? '')
        const s = isNote ? getNoteHubStatuses(d) : getInvoiceHubStatuses(d)
        const hasFolio = d.number && d.number !== 'Draft'
        const showProduction = Boolean(s.production && s.production !== 'not_applicable')

        statuses = {
            ...s,
            progress: {
                origin: isNote ? 100 : s.origin === 'success' || s.origin === 'destructive' ? 100 : s.origin === 'active' ? 50 : 0,
                production: s.production === 'warning' ? 100 : (s.productionProgress ?? 0),
                billing: hasFolio ? 100 : 0,
                treasury: s.treasuryProgress ?? 0,
                logistics: s.logisticsProgress ?? 0,
            }
        }

        tooltips = {
            production: showProduction
                ? (s.production === 'warning' ? 'Producción: falta crear OT' : `Producción: ${s.productionProgress ?? 0}%`)
                : undefined,
            origin: (() => {
                if (isNote) {
                    const source = d.corrected_invoice?.display_id || d.corrected_invoice?.number || "Factura"
                    const order = d.sale_order_number || d.purchase_order_number || ""
                    return `Origen: ${source}${order ? ` (${order})` : ''}`
                }
                return `Documento: ${translateStatus(d.status)}`
            })(),
            logistics: (() => {
                if (isNote) {
                    // ADR-0083 U6: el detalle de despachos/movimientos está en la ficha (Relaciones)
                    return s.logistics === 'success' ? "Logística: Completada" : s.logistics === 'active' ? "Logística: En curso" : "Sin movimientos"
                }
                return (s.logistics === 'success' ? "Logística: Completada" : s.logistics === 'active' ? `Logística: ${s.logisticsProgress}%` : "Logística: Pendiente")
            })(),
            billing: (() => {
                if (isNote && d.number && d.number !== 'Draft') {
                    const prefix = getDtePrefix(d.dte_type ?? '')
                    const rawNum = d.number.toString()
                    const knownPrefixes = [prefix, prefix.replace('-', ''), ...(prefix.includes('-') ? [prefix.split('-')[0]] : [])]
                    const num = knownPrefixes.some((p) => rawNum.toUpperCase().startsWith(p.toUpperCase())) ? rawNum : `${prefix}-${rawNum}`
                    return `Facturación: ${num}`
                }
                return s.billing === 'success' ? "Folio Generado" : "Pendiente de Folio"
            })(),
            treasury: isNote
                ? `Tesorería: ${translateStatus(String(d.payment_status || d.status))}`
                : (s.treasury === 'success' ? "Pagado" : s.treasury === 'active' ? "Pago Parcial / Pendiente TR" : "Pendiente de Pago")
        }
    }

    if (!statuses) return null

    return <HubStatus statuses={{ ...statuses, tooltips }} className={className} />
}
