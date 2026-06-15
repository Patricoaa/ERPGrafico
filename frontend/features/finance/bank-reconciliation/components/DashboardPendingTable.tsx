
"use client"

import React, { useMemo } from "react"
import { formatCurrency } from "@/lib/money"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn, formatPlainDate } from "@/lib/utils"
import type { DashboardPendingItem } from "../types"
import { Button } from "@/components/ui/button"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Chip } from "@/components/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { createActionsColumn, DataCell } from '@/components/shared'

interface DashboardPendingTableProps {
    data: DashboardPendingItem[]
    loading?: boolean
}

export function DashboardPendingTable({ data, loading }: DashboardPendingTableProps) {
    const router = useRouter()
    const columns = useMemo<ColumnDef<DashboardPendingItem>[]>(() => [
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-mono font-bold text-xs tracking-tight">
                        {formatPlainDate(row.getValue("date"))}
                    </span>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest opacity-60"> {/* intentional: badge density */}
                        {row.original.days_pending} días
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "account",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cuenta" />,
            cell: ({ row }) => (
                <Chip size="xs" intent="neutral" className="rounded-sm bg-muted/20">
                    {row.getValue("account")}
                </Chip>
            ),
        },
        {
            accessorKey: "description",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Descripción" />,
            cell: ({ row }) => (
<Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="text-xs font-medium text-foreground/70 truncate max-w-[200px]">
                                        {row.getValue("description")}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent side="top">{row.getValue("description")}</TooltipContent>
                            </Tooltip>
            ),
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-end" />,
            cell: ({ row }) => {
                const amount = row.original.amount
                const isCredit = row.original.is_credit
                return (
                    <div className={cn(
                        "text-right font-mono font-black text-[12px]",
                        isCredit ? "text-income" : "text-expense"
                    )}>
                        {isCredit ? '+' : '-'}{formatCurrency(Math.abs(amount))}
                    </div>
                )
            },
        },
        {
            accessorKey: "is_overdue",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => row.original.is_overdue && (
                <Chip size="xs" intent="destructive" className="shadow-sm shadow-destructive/20">
                    Crítico
                </Chip>
            ),
        },
        createActionsColumn<DashboardPendingItem>({
            headerLabel: "",
            renderActions: (item) => (
                <DataCell.Action
                    icon={ArrowRight}
                    title="Resolver"
                    onClick={() => router.push(`/treasury/reconciliation/${item.statement_id}/workbench`)}
                />
            )
        })
    ], [router])

    return (
        <div className="col-span-4 lg:col-span-3 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={data}
                    isLoading={loading}
                    variant="embedded"
                    searchPlaceholder="Buscar sin conciliar..."
                    globalFilterFields={["description", "account"]}
                    rightAction={
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-black uppercase tracking-widest border border-border/40" asChild>
                            <Link href="/treasury/reconciliation?filter=in_progress">
                                Ver Todo
                            </Link>
                        </Button>
                    }
                />
            </div>
        </div>
    )
}

