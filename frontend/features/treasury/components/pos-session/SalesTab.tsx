"use client"

import { HandCoins, Hash, Receipt, TrendingUp, Undo2, Wallet } from "lucide-react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { SkeletonShell, Metric, MetricStrip, Section } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { posSessionSaleRowEntity, posSessionSaleRowViews } from "../../entity-view/posSessionDetail.entity"
import type { POSSessionOverview } from "../../types"
import { formatCurrency } from "@/lib/money"

interface SalesTabProps {
    overview: POSSessionOverview | undefined
    isLoading: boolean
}

/**
 * Qué se vendió, qué se devolvió y cómo se cobró, con trazabilidad por OV. Ventas y
 * devoluciones son métricas separadas: 86 ventas + 3 devoluciones son 89 registros, no 89 ventas.
 */
export function SalesTab({ overview, isLoading }: SalesTabProps) {
    const { openEntity } = useGlobalModals()
    const collection = useEntityCollection(
        posSessionSaleRowEntity,
        { rows: overview?.sales.rows ?? [] },
        { pagination: { mode: "client", pageSize: 10 } },
    )

    return (
        <SkeletonShell isLoading={isLoading || !overview} ariaLabel="Cargando ventas de la sesión" className="flex flex-1 min-h-0 flex-col">
            {overview && (
                <div className="flex flex-1 min-h-0 flex-col gap-8">
                    <div className="grid shrink-0 gap-3 lg:grid-cols-[3fr_2fr]">
<MetricStrip label="Balance comercial">
                        <Metric label="Ventas" value={formatCurrency(Number(overview.sales.gross))} context={overview.sales.includes_tax ? "IVA incluido" : "Netas de IVA"} lead={Wallet} />
                        <Metric label="Devoluciones" value={formatCurrency(Number(overview.sales.returns_total))} lead={Undo2} tone="warning" />
                        <Metric label="Ventas netas" value={formatCurrency(Number(overview.sales.net))} context="Ventas − devoluciones" lead={TrendingUp} tone="success" />
                        </MetricStrip>
<MetricStrip label="Cobranza y registros">
<Metric label="Por cobrar" value={formatCurrency(Number(overview.sales.pending))} context={`Cobrado ${formatCurrency(Number(overview.sales.collected))} de ${formatCurrency(Number(overview.sales.net))}`} lead={HandCoins} tone={Number(overview.sales.pending) > 0 ? "warning" : "success"} />
                        <Metric label="Registros" value={overview.sales.sale_count + overview.sales.return_count} context={`${overview.sales.sale_count} ventas · ${overview.sales.return_count} devoluciones${overview.sales.collection_count ? ` · ${overview.sales.collection_count} cobros de otras ventas` : ""}`} lead={Hash} />
                    </MetricStrip>
</div>

                    <section aria-label="Movimientos comerciales" className="flex flex-1 min-h-0 flex-col gap-4">
                        <Section.Header spaced title="Movimientos comerciales" icon={Receipt} className="shrink-0" />
                        <Collection.Root
                            collection={collection}
                            label="Ventas y devoluciones de la sesión"
                            onOpen={(row) => openEntity(row.label, row.id)}
                        >
                            <Collection.View
                                table={posSessionSaleRowViews.table}
                                emptyTitle="Sin ventas en esta sesión"
                                emptyDescription="Las ventas y devoluciones aparecerán aquí."
                            />
                        </Collection.Root>
                    </section>
                </div>
            )}
        </SkeletonShell>
    )
}
