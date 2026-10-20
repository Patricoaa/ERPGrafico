"use client"
import { formatPlainDate, parseDateOnly } from "@/lib/utils"
import { formatCurrency } from "@/lib/money"
import { getChartPalette } from "@/lib/chart-colors"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartLegend, SectionCard, SkeletonShell, StatCard, PieChart, StaleDataBanner } from '@/components/shared'
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
    const { data: statement, isLoading, isError } = usePartnerStatement(contactId)

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

    if (!statement) return null

    const { contact, summary } = statement
    const equityPct = pieData.find((d) => d.id === contact.name)?.value ?? 0
    const partnerSince = contact.partner_since || contact.created_at

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil de socio">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            <div className="h-full overflow-y-auto custom-scrollbar space-y-6">
                {/* Top: Distribution chart (left, wider) + stacked KPIs (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <SectionCard
                        title="Distribución de capital"
                        description="Participación porcentual de los socios"
                        headerRight={<ChartLegend items={pieData.map((d) => ({ label: String(d.id), color: d.color }))} />}
                        chartHeight="320px"
                        className="rounded-sm lg:col-span-2"
                    >
                        <div className="h-full">
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
                                margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                                centerLabel={{ value: `${equityPct}%`, label: "Participación" }}
                                renderTooltip={(datum) => (
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: datum.color }} />
                                        <span className="font-medium">{String(datum.label ?? datum.id)}</span>
                                        <span className="font-bold">{datum.value.toFixed(1)}%</span>
                                    </div>
                                )}
                            />
                        </div>
                    </SectionCard>

                    <div className="flex flex-col gap-3">
                        <StatCard
                            value={contact.name}
                            subtext={partnerSince ? `Socio desde ${formatPlainDate(partnerSince)}` : "Socio desde —"}
                            variant="default"
                            accent="primary"
                        />
                        <StatCard
                            label="Capital suscrito"
                            value={formatCurrency(summary.total_contributions)}
                            variant="default"
                            accent="primary"
                        />
                        <StatCard
                            label="Capital pagado"
                            value={formatCurrency(summary.total_paid_in)}
                            variant="default"
                            accent="success"
                        />
                        <StatCard
                            label="Retiro provisorio"
                            value={formatCurrency(summary.provisional_withdrawals)}
                            variant="default"
                            accent="warning"
                        />
                        <StatCard
                            label="Utilidades retenidas"
                            value={formatCurrency(summary.earnings_balance)}
                            variant="default"
                            accent="info"
                        />
                    </div>
                </div>

                {/* Bottom: Capital History — flows naturally, page scrolls */}
                <Card className="w-full">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm text-primary">Historial de Capital</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Collection.Root collection={txCollection} label="Historial de Capital">
                            <Collection.View
                                table={partnerTransactionViews.table}
                                emptyTitle="Sin movimientos"
                                emptyDescription="No hay movimientos de capital registrados."
                            />
                        </Collection.Root>
                    </CardContent>
                </Card>
            </div>
        </SkeletonShell>
    )
}
