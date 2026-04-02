"use client"

import React, { useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatPlainDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"

interface DashboardPendingTableProps {
    data: any[]
}

export function DashboardPendingTable({ data }: DashboardPendingTableProps) {
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-mono font-bold text-[11px] tracking-tight">
                        {formatPlainDate(row.getValue("date"))}
                    </span>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest opacity-60">
                        {row.original.days_pending} días
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "account",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cuenta" />,
            cell: ({ row }) => (
                <Badge variant="outline" className="rounded-[0.125rem] text-[10px] border-border/40 font-bold uppercase tracking-wider bg-muted/20">
                    {row.getValue("account")}
                </Badge>
            ),
        },
        {
            accessorKey: "description",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Descripción" />,
            cell: ({ row }) => (
                <p className="text-[11px] font-medium text-foreground/70 truncate max-w-[200px]" title={row.getValue("description")}>
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
                        isCredit ? "text-emerald-700" : "text-rose-700"
                    )}>
                        {isCredit ? '+' : '-'}${amount.toLocaleString()}
                    </div>
                )
            },
        },
        {
            accessorKey: "is_overdue",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => row.original.is_overdue && (
                <Badge variant="destructive" className="text-[9px] uppercase font-black px-1.5 h-4 tracking-tighter">
                    Crítico
                </Badge>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] font-black uppercase tracking-widest group" asChild>
                    <Link href={`/treasury/reconciliation/${row.original.statement_id}/match`}>
                        Resolver
                        <ArrowRight className="ml-1.5 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </Button>
            ),
        }
    ], [])

    return (
        <div className="col-span-4 lg:col-span-3">
            <DataTable
                columns={columns}
                data={data}
                cardMode
                title="Pendientes Críticos (>7 días)"
                searchPlaceholder="Filtrar pendientes..."
                globalFilterFields={["description", "account"]}
                rightAction={
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest border border-border/40" asChild>
                        <Link href="/treasury/reconciliation/match">
                            Ver Todo
                        </Link>
                    </Button>
                }
            />
        </div>
    )
}

// Helper to avoid import issues
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ")
}
