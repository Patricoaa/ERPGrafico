"use client"
import { formatPlainDate, parseDateOnly } from "@/lib/utils"
import { formatCurrency } from "@/lib/money"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Chip, DataCell, DataTable, DataTableColumnHeader, LabeledContainer, SkeletonShell, StatCard, PieChart } from '@/components/shared'
import { partnerTransactionActions, type PartnerTransactionActionsCtx } from './partnerTransactionActions'
import {
    CalendarDays,
    User,
    FileText,
    Landmark,
} from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { type PartnerTransaction, usePartners } from "@/features/contacts"
import { PaymentDrawer } from "@/features/treasury"
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

    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)

    const handleViewDetails = (movementId: number) => {
        setSelectedMovementId(movementId)
        setDetailsOpen(true)
    }

    const closeDetails = () => {
        setDetailsOpen(false)
        setSelectedMovementId(null)
    }

    const actionsCtx: PartnerTransactionActionsCtx = { onViewMovement: handleViewDetails }

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
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const direction = isOutflow(type) ? 'outflow' : 'inflow' as const
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.CurrencyFlow value={row.getValue("amount")} direction={direction} showIcon={false} />
                    </div>
                )
            },
        },
        {
            accessorKey: "balance_after",
            header: () => <div className="text-right">Saldo</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-black text-primary bg-primary/5 px-2 py-1">
                    {formatCurrency(row.getValue("balance_after"))}
                </div>
            ),
        },
        partnerTransactionActions.column(actionsCtx) as ColumnDef<PartnerTransaction & { balance_after: number }>,
    ]

    if (isError || !statement) return null

    const { contact, summary, partner_account_detail } = statement
    const equityPct = parseFloat(summary.equity_percentage) || 0

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando perfil de socio">
            <div className="flex flex-col">
                {/* Top: Información Societaria — compact, no scroll */}
                <div className="shrink-0 p-4 pb-2">
                    <Card className="w-full">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm text-primary">Información Societaria</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid grid-cols-8 gap-6">
                                {/* Left: Partner info + account — notched */}
                                <div className="col-span-2 space-y-4">
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

                                {/* Middle: PieChart */}
                                <div className="col-span-3">
                                    <Card className="h-full flex flex-col">
                                        <CardContent className="flex-1 min-h-0 p-0">
                                            <div className="h-full">
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
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Right: Key metrics */}
                                <div className="col-span-3 grid grid-rows-4 gap-3">
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
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom: Capital History — scrollable */}
                <div className="p-4 pt-2">
                    <Card className="w-full flex flex-col">
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
                </div>

            {selectedMovementId && (
                <PaymentDrawer
                    paymentId={selectedMovementId}
                    mode="view"
                    open={detailsOpen}
                    onOpenChange={(open) => !open && closeDetails()}
                />
            )}
            </div>
        </SkeletonShell>
    )
}
