"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { useReconciliation } from "../hooks/useReconciliation"
import type { BankStatement } from "../types"
import { StatementImportDialog } from "@/features/treasury"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface StatementsListProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export function StatementsList({ externalOpen = false, createAction }: StatementsListProps) {
    const router = useRouter()
    const { fetchStatements, loading } = useReconciliation()
    const [statements, setStatements] = useState<BankStatement[]>([])
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    // Open import dialog when triggered via URL (?modal=import)
    useEffect(() => {
        if (externalOpen) {
            setImportDialogOpen(true)
        }
    }, [externalOpen])

    const loadData = async () => {
        const data = await fetchStatements()
        setStatements(data)
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleImportSuccess = () => {
        loadData()
        setImportDialogOpen(false)
        // Clear modal param from URL
        router.replace('/treasury/reconciliation?tab=statements')
    }

    const handleDialogChange = (open: boolean) => {
        setImportDialogOpen(open)
        if (!open) {
            router.replace('/treasury/reconciliation?tab=statements')
        }
    }

    const columns: ColumnDef<BankStatement>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="ID" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Code className="font-bold">{row.getValue("display_id")}</DataCell.Code>
                </div>
            ),
        },
        {
            accessorKey: "treasury_account_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuenta" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>{row.getValue("treasury_account_name")}</DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "statement_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("statement_date")} />
                </div>
            ),
        },
        {
            accessorKey: "opening_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Apertura" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.getValue("opening_balance")} className="text-muted-foreground" />
                </div>
            ),
        },
        {
            accessorKey: "closing_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cierre" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.getValue("closing_balance")} className="font-bold text-foreground" />
                </div>
            ),
        },
        {
            id: "lines_info",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Líneas" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
                    <span className="font-semibold text-xs">{row.original.total_lines} total</span>
                    <span className="text-[10px] text-muted-foreground">
                        {row.original.reconciled_lines} rec.
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "reconciliation_progress",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Progreso" className="justify-center" />
            ),
            cell: ({ row }) => {
                const progress = parseFloat(row.getValue("reconciliation_progress") as string)
                return (
                    <div className="flex items-center justify-center gap-2 min-w-[120px] w-full">
                        <Progress value={progress} className="h-1.5 w-16" />
                        <span className="text-[10px] font-mono font-bold w-8 text-right">
                            {Math.round(progress)}%
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.getValue("state") as string} label={row.original.state_display} />
                </div>
            ),
        },
        createActionsColumn<BankStatement>({
            renderActions: (item) => (
                <DataCell.Action
                    icon={Eye}
                    title="Ver"
                    onClick={() => router.push(`/treasury/reconciliation/${item.id}`)}
                />
            )
        })
    ]

    return (
        <>
            <DataTable
                columns={columns}
                data={statements}
                cardMode
                isLoading={loading}
                globalFilterFields={["treasury_account_name", "display_id"]}
                searchPlaceholder="Buscar por ID..."
                facetedFilters={[
                    {
                        column: "state",
                        title: "Estado",
                        options: [
                            { label: "Borrador", value: "DRAFT" },
                            { label: "Confirmado", value: "CONFIRMED" },
                            { label: "Anulado", value: "CANCELLED" },
                        ]
                    }
                ]}
                useAdvancedFilter={true}
                defaultPageSize={10}
                createAction={createAction}
            />

            <StatementImportDialog
                open={importDialogOpen}
                onOpenChange={handleDialogChange}
                onSuccess={handleImportSuccess}
            />
        </>
    )
}
