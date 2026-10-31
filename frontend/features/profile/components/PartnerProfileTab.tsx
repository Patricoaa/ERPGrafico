"use client"
import { formatPlainDate, parseDateOnly } from "@/lib/utils"
import { formatCurrency } from "@/lib/money"
import { getChartPalette } from "@/lib/chart-colors"

import { useMemo } from "react"
import { ChartLegend, EmptyState, SkeletonShell, PieChart, StaleDataBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { usePartners, netEquityPercentages } from "@/features/contacts"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { usePartnerStatement } from "../hooks/usePartnerStatement"
import { partnerTransactionEntity, partnerTransactionViews } from "../entity-view/partnerTransaction.entity"

interface Props {
    contactId: number
}

const isInflow = (type: string) =>
    ['CAPITAL_CASH', 'CAPITAL_INVENTORY', 'TRANSFER_IN', 'REINVESTMENT', 'RETAINED'].includes(type)

const isOutflow = (type: string) =>
    ['WITHDRAWAL', 'PROV_WITHDRAWAL', 'REDUCTION', 'TRANSFER_OUT', 'LOSS_ABSORB', 'DIVIDEND_PAY'].includes(type)

export function PartnerProfileTab({ contactId }: Props) {
    const { data: statement, isLoading, isError, refetch } = usePartnerStatement(contactId)

    const { partners } = usePartners()

    const txsWithBalance = useMemo(() => {
        if (!statement?.transactions) return []
        const sorted = [...statement.transactions].sort((a, b) => {
            const dateDiff = parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime()
            if (dateDiff !== 0) return dateDiff
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
        let balance = 0
        return sorted
            .map((tx) => {
                const amount = parseFloat(tx.amount) || 0
                if (isInflow(tx.transaction_type)) balance += amount
                else if (isOutflow(tx.transaction_type)) balance -= amount
                return { ...tx, balance_after: balance }
            })
            .reverse()
    }, [statement])

    const equityPctById = useMemo(() => netEquityPercentages(partners ?? []), [partners])

    const pieData = useMemo(() => {
        const palette = getChartPalette()
        const activeName = statement?.contact?.name
        return (Array.isArray(partners) ? partners : [])
            .filter(p => (Number(p.partner_net_equity) || 0) > 0)
            .map((p, i) => ({
                id: p.name,
                value: parseFloat(equityPctById[p.id] ?? "0") || 0,
                color: p.name === activeName ? "var(--primary)" : palette[i % palette.length],
            }))
    }, [partners, equityPctById, statement?.contact?.name])

    const txCollection = useEntityCollection(partnerTransactionEntity, { rows: txsWithBalance }, { pagination: { mode: "none" } })

    if (!statement) {
        if (isLoading) return <SkeletonShell isLoading ariaLabel="Cargando perfil de socio" />
        return (
            <EmptyState
                context="finance"
                variant="compact"
                title={isError ? "No se pudo cargar la información societaria" : "Sin información societaria"}
                description={isError ? "Comprueba la conexión e inténtalo nuevamente." : "No hay datos de participación disponibles."}
                action={isError ? <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button> : undefined}
            />
        )
    }

    const { contact, summary } = statement
    const equityPct = pieData.find((d) => d.id === contact.name)?.value ?? 0
    const partnerSince = contact.partner_since || contact.created_at

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil de socio">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            <div className="h-full overflow-y-auto custom-scrollbar space-y-8">
                {/* Resumen de capital */}
                <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)] lg:gap-10">
                    <section className="flex min-w-0 flex-col">
                        <header className="mb-2 flex items-start justify-between gap-4 border-b border-border/70 pb-3">
                            <div>
                                <h2 className="text-base font-semibold text-foreground">Distribución de capital</h2>
                            </div>
                        </header>
                        <div className="min-h-[200px] flex-1 sm:min-h-[200px]">
                            <PieChart
                                data={pieData}
                                activeId={contact.name}
                                activeOuterRadiusOffset={14}
                                activeInnerRadiusOffset={8}
                                innerRadius={0.55}
                                padAngle={1.5}
                                cornerRadius={4}
                                borderWidth={1.5}
                                borderColor={{ theme: "background" }}
                                enableArcLabels={false}
                                enableArcLinkLabels={false}
                                legends={[]}
                                margin={{ top: 12, right: 20, bottom: 12, left: 20 }}
                                centerLabel={{ value: `${equityPct}%`, label: "Participación" }}
                                renderTooltip={(datum) => (
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: datum.color }} />
                                        <span className="font-medium">{String(datum.label ?? datum.id)}</span>
                                        <span className="font-normal text-sm">{datum.value.toFixed(1)}%</span>
                                    </div>
                                )}
                            />
                        </div>
                        <div className="flex min-h-10 items-center justify-center border-border/60 pt-2">
                            <ChartLegend items={pieData.map((d) => ({ label: String(d.id), color: d.color }))} />
                        </div>
                    </section>
                    <section aria-labelledby="partner-summary-heading" className="flex min-w-0 flex-col">
                        <h2 id="partner-summary-heading" className="border-b border-border/70 pb-3 text-base font-semibold text-foreground">Resumen</h2>
                        <dl className="flex flex-1 flex-col divide-y divide-border/70">
                        <div className="flex items-center justify-between gap-3 py-3">
                            <dt className="text-xs text-muted-foreground">Socio</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{partnerSince ? `Desde ${formatPlainDate(partnerSince)}` : "Desde —"}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <dt className="text-sm text-muted-foreground">Capital suscrito</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(summary.total_contributions)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <dt className="text-sm text-muted-foreground">Capital pagado</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(summary.total_paid_in)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <dt className="text-sm text-muted-foreground">Retiro provisorio</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(summary.provisional_withdrawals)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <dt className="text-sm text-muted-foreground">Utilidades retenidas</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(summary.earnings_balance)}</dd>
                        </div>
                        <div className="flex-1" aria-hidden="true" />
                        </dl>
                    </section>
                </div>

                {/* Bottom: Capital History — flows naturally, page scrolls */}
                <section>
                    <header className="mb-3 border-b border-border/70 pb-3">
                        <h2 className="text-base font-semibold text-foreground">Historial de capital</h2>
                    </header>
                    <div className="[&>div>div]:rounded-none [&>div>div]:border-0">
                    <Collection.Root collection={txCollection} label="Historial de Capital">
                        <Collection.View
                            table={partnerTransactionViews.table}
                            emptyTitle="Sin movimientos"
                            emptyDescription="No hay movimientos de capital registrados."
                        />
                    </Collection.Root>
                    </div>
                </section>
            </div>
        </SkeletonShell>
    )
}
