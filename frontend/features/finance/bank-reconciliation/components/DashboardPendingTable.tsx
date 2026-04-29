"use client"

import React, { useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn, formatPlainDate, formatCurrency } from "@/lib/utils"
import type { DashboardPendingItem } from "../types"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"

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
                <Badge variant="outline" className="rounded-sm text-[10px] border-border/40 font-bold uppercase tracking-wider bg-muted/20"> {/* intentional: badge density */}
                    {row.getValue("account")}
                </Badge>
            ),
        },
        {
            accessorKey: "description",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Descripción" />,
            cell: ({ row }) => (
                <p className="text-xs font-medium text-foreground/70 truncate max-w-[200px]" title={row.getValue("description")}>
                    {row.getValue("description")}
                </p>
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
                        isCredit ? "text-success" : "text-destructive"
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
                <Badge variant="destructive" className="text-[10px] uppercase font-black px-1.5 h-4 tracking-tighter shadow-sm shadow-destructive/20"> {/* intentional: badge density */}
                    Crítico
                </Badge>
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
        <div className="col-span-4 lg:col-span-3">
            <DataTable
                columns={columns}
                data={data}
                isLoading={loading}
                cardMode
                searchPlaceholder="Filtrar sin conciliar..."
                globalFilterFields={["description", "account"]}
                rightAction={
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-black uppercase tracking-widest border border-border/40" asChild>
                        <Link href="/treasury/reconciliation?tab=statements&filter=in_progress">
                            Ver Todo
                        </Link>
                    </Button>
                }
            />
        </div>
    )
}

