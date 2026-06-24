"use client"
import { formatPlainDate } from "@/lib/utils";

import React, {useState} from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Chip, FadeIn, MoneyDisplay, StatCard } from '@/components/shared'
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { partnerTransactionActions, type PartnerTransactionActionsCtx } from './partnerTransactionActions'
import {
    CalendarDays,
    User,
    FileText,
    Building2,
    Eye
} from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { type PartnerTransaction } from "@/features/contacts/types/partner"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

import { cn } from "@/lib/utils"
import {SkeletonShell} from "@/components/shared"

import { PaymentDrawer } from "@/features/treasury/components/PaymentDrawer"
import { usePartnerStatement } from "../hooks/usePartnerStatement"

interface Props {
    contactId: number;
}

export function PartnerProfileTab({ contactId }: Props) {
    const { data: statement, isLoading, isError } = usePartnerStatement(contactId)

    // Movement Details state
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)

    const handleViewDetails = (movementId: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(movementId))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeDetails = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setDetailsOpen(false)
        setSelectedMovementId(null)
    }

    const actionsCtx: PartnerTransactionActionsCtx = { onViewMovement: handleViewDetails }

    const columns: ColumnDef<PartnerTransaction>[] = [
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
                const tx = row.original;
                const type = tx.transaction_type;
                let intent: 'success' | 'warning' | 'info' | 'neutral' = 'neutral';

                if (type === 'SUBSCRIPTION' || type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY' || type === 'TRANSFER_IN') {
                    intent = 'success';
                } else if (type === 'WITHDRAWAL' || type === 'REDUCTION' || type === 'TRANSFER_OUT') {
                    intent = 'warning';
                } else if (type === 'LOAN_IN') {
                    intent = 'info';
                }

                return (
                    <div className="flex justify-center w-full">
                        <Chip size="xs" intent={intent}>
                            {tx.transaction_type_display || type}
                        </Chip>
                    </div>
                );
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Monto" />,
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const amount = row.getValue("amount") as string
                const isNegative = type === 'WITHDRAWAL' || type === 'REDUCTION' || type === 'TRANSFER_OUT' || type === 'LOAN_OUT'

                return (
                    <div className={cn("flex items-center justify-center gap-1 font-bold w-full", isNegative ? 'text-destructive' : 'text-success')}>
                        <span>{isNegative ? '-' : '+'}</span>
                        <DataCell.Currency value={amount} className="" />
                    </div>
                )
            },
        },
        partnerTransactionActions.column(actionsCtx)
    ]

    if (isLoading) return <SkeletonShell isLoading ariaLabel="Cargando..." />

    if (isError || !statement) return null

    const { contact, summary } = statement

    return (

        <div className="flex flex-col w-full h-full space-y-6">
            <Accordion type="multiple" defaultValue={["summary", "history"]} className="w-full space-y-6">

                {/* Section 1: Metrics & Summary */}
                <AccordionItem value="summary" className="border-none">
                    <FadeIn yOffset={10}>
                        <Card >
                            <AccordionTrigger className="hover:no-underline py-0">
                                <CardHeader className="w-full">
                                    <CardTitle className="text-lg text-primary">Resumen Patrimonial</CardTitle>
                                    <CardDescription>Estado de capitalización neta</CardDescription>
                                </CardHeader>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <StatCard
                                            label="Participación"
                                            value={`${summary.equity_percentage}%`}
                                            subtext="Participación sobre el total patrimonial"
                                            variant="minimal"
                                            accent="muted"
                                            className="p-4 justify-center text-center"
                                            valueSize="xl"
                                        />
                                        <StatCard
                                            label="Saldo Particular Neto"
                                            value={<MoneyDisplay amount={parseFloat(summary.balance)} />}
                                            subtext="Neto acumulado de aportes y retiros"
                                            variant="minimal"
                                            accent="primary"
                                            className="md:col-span-2 p-4 justify-center items-center text-center"
                                        />
                                    </div>
                                </CardContent>
                            </AccordionContent>
                        </Card>
                    </FadeIn>
                </AccordionItem>

                {/* Section 2: Societal Info */}
                <AccordionItem value="info" className="border-none">
                    <FadeIn delay={0.1} yOffset={10}>
                        <Card >
                            <AccordionTrigger className="hover:no-underline py-0">
                                <CardHeader className="w-full">
                                    <CardTitle className="text-lg text-primary">Información Societaria</CardTitle>
                                    <CardDescription>Identificación y cuentas vinculadas</CardDescription>
                                </CardHeader>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <InfoField icon={<User className="h-3.5 w-3.5" />} label="Socio" value={contact.name} />
                                        <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="RUT" value={contact.tax_id} />
                                        <InfoField
                                            icon={<Building2 className="h-3.5 w-3.5" />}
                                            label="Cuenta Particular"
                                            value={contact.partner_account_detail ? `${contact.partner_account_detail.name} (${contact.partner_account_detail.code})` : "No asignada"}
                                        />
                                        <InfoField
                                            icon={<CalendarDays className="h-3.5 w-3.5" />}
                                            label="Socio desde"
                                            value={(contact.partner_since || contact.created_at) ? formatPlainDate(contact.partner_since || contact.created_at) : "—"}
                                        />
                                    </div>
                                </CardContent>
                            </AccordionContent>
                        </Card>
                    </FadeIn>
                </AccordionItem>

                {/* Section 3: History */}
                <AccordionItem value="history" className="border-none">
                    <FadeIn delay={0.2} yOffset={10}>
                        <Card >
                            <AccordionTrigger className="hover:no-underline py-0">
                                <CardHeader className="w-full">
                                    <CardTitle className="text-lg text-primary">Historial de Capital</CardTitle>
                                    <CardDescription>Resumen de movimientos históricos</CardDescription>
                                </CardHeader>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
                                <DataTable
                                    columns={columns}
                                    data={statement.transactions}
                                    variant="minimal"
                                    noBorder={true}
                                    defaultPageSize={10}
                                />
                            </AccordionContent>
                        </Card>
                    </FadeIn>
                </AccordionItem>

            </Accordion>

            {selectedMovementId && (
                <PaymentDrawer
                    paymentId={selectedMovementId}
                    mode="view"
                    open={detailsOpen}
                    onOpenChange={(open) => !open && closeDetails()}
                />
            )}
        </div>
    )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/20 text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{icon}</span>
                {value}
            </div>
        </div>
    )
}
