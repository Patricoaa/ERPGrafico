"use client"
import { formatPlainDate, parseDateOnly } from "@/lib/utils"
import { formatCurrency } from "@/lib/money"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Chip, DataCell, DataTable, DataTableColumnHeader, LabeledContainer, SkeletonShell, StatCard, PieChart, StaleDataBanner } from '@/components/shared'
import { partnerTransactionActions, type PartnerTransactionActionsCtx } from './partnerTransactionActions'
import {
    CalendarDays,
    User,
    FileText,
    Landmark,
} from "lucide-react"
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

    const pieData = useMemo(() =>
        (partners || [])
            .filter(p => parseFloat(p.partner_equity_percentage) > 0)
            .map(p => ({
                id: p.name,
                value: parseFloat(p.partner_equity_percentage) || 0,
            })),
        [partners],
    )

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

    const { contact, summary, partner_account_detail } = statement
    const equityPct = parseFloat(summary.equity_percentage) || 0

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil de socio">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            <div className="h-full overflow-y-auto custom-scrollbar space-y-6">
                {/* Top: Partner info — labeled containers in a horizontal row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <LabeledContainer label="Socio">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {contact.name}
                        </div>
                    </LabeledContainer>
                    <LabeledContainer label="RUT">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            {contact.tax_id}
                        </div>
                    </LabeledContainer>
                    <LabeledContainer label="Socio desde">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {(contact.partner_since || contact.created_at)
                                ? formatPlainDate(contact.partner_since || contact.created_at)
                                : "—"}
                        </div>
                    </LabeledContainer>
                    <LabeledContainer label="Cuenta particular">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
                            <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                            {partner_account_detail
                                ? `${partner_account_detail.code} — ${partner_account_detail.name}`
                                : "—"}
                        </div>
                    </LabeledContainer>
                </div>

                {/* Middle: Distribution chart + key metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <Card className="lg:col-span-3 h-[320px] flex flex-col">
                        <CardHeader className="py-3 pb-0">
                            <CardTitle className="text-sm text-primary">Distribución de capital</CardTitle>
                            <CardDescription className="text-xs">Participación porcentual de los socios</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 p-0 pt-2">
                            <PieChart
                                data={pieData}
                                activeId={contact.name}
                                innerRadius={0.4}
                                padAngle={2}
                                cornerRadius={3}
                                enableArcLabels={false}
                                enableArcLinkLabels={true}
                                arcLinkLabel={(datum: { id: string | number }) => String(datum.id)}
                                margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                                centerLabel={{ value: `${equityPct}%`, label: "Participación" }}
                                tooltipFormat="currency"
                            />
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-2 grid grid-cols-2 gap-3">
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
