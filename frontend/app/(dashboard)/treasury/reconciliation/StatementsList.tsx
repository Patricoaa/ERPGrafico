"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import api from "@/lib/api"
import { StatementImportDialog } from "@/features/treasury"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { Progress } from "@/components/ui/progress"

interface BankStatement {
    id: number
    display_id: string
    treasury_account_name: string
    statement_date: string
    opening_balance: string
    closing_balance: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
    state: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
    state_display: string
    imported_by_name: string
    imported_at: string
}

interface StatementsListProps {
    externalOpen?: boolean
}

export function StatementsList({ externalOpen = false }: StatementsListProps) {
    const router = useRouter()
    const [statements, setStatements] = useState<BankStatement[]>([])
    const [loading, setLoading] = useState(true)
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    // Open import dialog when triggered via URL (?modal=import)
    useEffect(() => {
        if (externalOpen) {
            setImportDialogOpen(true)
        }
    }, [externalOpen])

    useEffect(() => {
        fetchStatements()
    }, [])

    const fetchStatements = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/statements/')
            setStatements(response.data)
        } catch (error) {
            console.error('Error fetching statements:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleImportSuccess = () => {
        fetchStatements()
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
                <DataTableColumnHeader column={column} title="ID" />
            ),
            cell: ({ row }) => <DataCell.Code className="font-bold">{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorKey: "treasury_account_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuenta" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("treasury_account_name")}</DataCell.Text>,
        },
        {
            accessorKey: "statement_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("statement_date")} />,
        },
        {
            accessorKey: "opening_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Apertura" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("opening_balance")} className="text-muted-foreground" />,
        },
        {
            accessorKey: "closing_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cierre" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("closing_balance")} className="font-bold text-foreground" />,
        },
        {
            id: "lines_info",
            header: "Líneas",
            cell: ({ row }) => (
                <div className="flex flex-col">
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
                <DataTableColumnHeader column={column} title="Progreso" />
            ),
            cell: ({ row }) => {
                const progress = parseFloat(row.getValue("reconciliation_progress") as string)
                return (
                    <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={progress} className="h-2" />
                        <span className="text-[10px] font-medium w-8">
                            {progress}%
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("state") as string
                const variant = state === 'CONFIRMED' ? 'success' : state === 'CANCELLED' ? 'destructive' : 'secondary'
                return (
                    <DataCell.Badge variant={variant}>
                        {row.original.state_display}
                    </DataCell.Badge>
                )
            },
        },
        {
            id: "actions",
            header: "Acción",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/treasury/reconciliation/${row.original.id}`)}
                    >
                        <Eye className="h-4 w-4 text-primary" />
                    </Button>
                </div>
            ),
        },
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
            />

            <StatementImportDialog
                open={importDialogOpen}
                onOpenChange={handleDialogChange}
                onSuccess={handleImportSuccess}
            />
        </>
    )
}
