"use client"
import { formatPlainDate, parseDateOnly } from "@/lib/utils"
import { formatCurrency } from "@/lib/money"
import { getChartPalette } from "@/lib/chart-colors"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Chip, ChartLegend, DataCell, DataTable, DataTableColumnHeader, SectionCard, SkeletonShell, StatCard, PieChart, StaleDataBanner } from '@/components/shared'
import { partnerTransactionActions, type PartnerTransactionActionsCtx } from './partnerTransactionActions'
import { User } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { type PartnerTransaction, usePartners } from "@/features/contacts"
import { LazyDrawer } from "@/features/_shared/transaction-drawer/drawerRegistry"
import { usePartnerStatement } from "../hooks/usePartnerStatement"

interface Props {
    contactId: number
}

const isInflow = (type: string) =>
    ['CAPITAL_CASH', 'CAPITAL_INVENTORY', 'TRANSFER_IN', 'REINVESTMENT', 'RETAINED'].includes(type)

const isOutflow = (type: string) =>
    ['WITHDRAWAL', 'PROV_WITHDRAWAL', 'REDUCTION', 'TRANSFER_OUT', 'LOSS_ABSORB', 'DIVIDEND_PAY'].includes(type)

export function PartnerProfileTab({ contactId }: Props) {
    const { data: statement, isLoading, isError } = usePartnerStatement(contactId)

    const [viewConfig, setViewConfig] = useState<{ type: string; id: number } | null>(null)

    const handleViewDocument = (type: string, id: number) => {
        setViewConfig({ type, id })
    }

    const closeDrawer = () => {
        setViewConfig(null)
    }

    const actionsCtx: PartnerTransactionActionsCtx = { onViewDocument: handleViewDocument }

    const { data: partners } = usePartners()

    const txsWithBalance = useMemo(() => {
        if (!statement?.transactions) return []
        const sorted = [...statement.transactions].sort(
            (a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime()
        )
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

    const totalNetEquity = useMemo(
        () =>
            (Array.isArray(partners) ? partners : []).reduce(
                (s, p) => s + (Number(p.partner_net_equity) || 0),
                0
            ),
        [partners]
    )

    const pieData = useMemo(() => {
        const palette = getChartPalette()
        const activeName = statement?.contact?.name
        return (Array.isArray(partners) ? partners : [])
            .filter(p => (Number(p.partner_net_equity) || 0) > 0)
            .map((p, i) => ({
                id: p.name,
                value:
                    totalNetEquity > 0
                        ? Math.round((Number(p.partner_net_equity) / totalNetEquity) * 10000) / 100
                        : 0,
                color: p.name === activeName ? "var(--primary)" : palette[i % palette.length],
            }))
    }, [partners, totalNetEquity, statement?.contact?.name])

    const columns: ColumnDef<PartnerTransaction & { balance_after: number }>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Fecha" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("date")} className="text-center" />
                </div>
            ),
        },
        {
            accessorKey: "transaction_type",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Operación" />,
            cell: ({ row }) => {
                const tx = row.original
                const type = tx.transaction_type
                let intent: 'success' | 'warning' | 'info' | 'neutral' = 'neutral'

                if (type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY' || type === 'TRANSFER_IN') {
                    intent = 'success'
                } else if (type === 'WITHDRAWAL' || type === 'REDUCTION' || type === 'TRANSFER_OUT') {
                    intent = 'warning'
                } else if (type === 'SUBSCRIPTION') {
                    intent = 'info'
                }

                return (
                    <div className="flex justify-center w-full">
                        <Chip size="xs" intent={intent}>
                            {tx.transaction_type_display || type}
                        </Chip>
                    </div>
                )
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Monto" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.getValue("amount")} />
                </div>
            ),
        },
        {
            accessorKey: "balance_after",
            header: () => <div className="text-right">Saldo</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-black text-foreground px-2 py-1">
                    {formatCurrency(row.getValue("balance_after"))}
                </div>
            ),
        },
        partnerTransactionActions.auto(actionsCtx) as ColumnDef<PartnerTransaction & { balance_after: number }>,
    ]

    if (!statement) return null

    const { contact, summary } = statement
    const equityPct = pieData.find((d) => d.id === contact.name)?.value ?? 0
    const partnerSince = contact.partner_since || contact.created_at

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil de socio">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            <div className="h-full overflow-y-auto custom-scrollbar space-y-6">
                {/* Top: KPI row — partner card + key metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    <StatCard
                        label="Socio"
                        value={contact.name}
                        icon={User}
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

                {/* Middle: Distribution chart — analytics panel style */}
                <SectionCard
                    title="Distribución de capital"
                    description="Participación porcentual de los socios"
                    headerRight={<ChartLegend items={pieData.map((d) => ({ label: String(d.id), color: d.color }))} />}
                    chartHeight="320px"
                    className="rounded-sm"
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

                {/* Bottom: Capital History — flows naturally, page scrolls */}
                <Card className="w-full">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm text-primary">Historial de Capital</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <DataTable
                            columns={columns}
                            data={txsWithBalance}
                            variant="embedded"
                            noBorder={true}
                            defaultPageSize={10}
                        />
                    </CardContent>
                </Card>

            {viewConfig && (
                <LazyDrawer
                    type={viewConfig.type}
                    id={viewConfig.id}
                    open={true}
                    onOpenChange={(open) => !open && closeDrawer()}
                />
            )}
            </div>
        </SkeletonShell>
    )
}
