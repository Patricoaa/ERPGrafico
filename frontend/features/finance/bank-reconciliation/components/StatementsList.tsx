"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Eye } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import type { BankStatement } from "../types"
import { StatementImportModal } from "@/features/treasury"
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
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { data: statements = [], isLoading, refetch } = useStatementsQuery()
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<BankStatement>({
        endpoint: '/treasury/statements'
    })
    const [importModalOpen, setImportModalOpen] = useState(false)

    const initialFilters = React.useMemo(() => {
        const filters = []
        if (searchParams.get("filter") === "in_progress") {
            filters.push({ id: "state", value: ["DRAFT"] })
        }
        return filters
    }, [searchParams])

    // Handle deep-linked statement selection (ADR-0020)
    // NOTE: clearSelection() is intentionally omitted — the destination URL
    // (/treasury/reconciliation/<id>) does NOT contain ?selected, so calling
    // router.replace here would race with the router.push and cause the user
    // to land on the list instead of the workbench ~5-10% of the time. (T-98)
    useEffect(() => {
        if (selectedFromUrl) {
            router.push(`/treasury/reconciliation/${selectedFromUrl.id}`)
        }
    }, [selectedFromUrl, router])

    // Open import dialog when triggered via URL (?modal=import)
    // T-105: cancelAnimationFrame cleanup prevents setState on unmounted component
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setImportModalOpen(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    const handleImportSuccess = () => {
        refetch()
        setImportModalOpen(false)
        // Clear modal param from URL
        router.replace('/treasury/reconciliation?tab=statements')
    }

    const handleModalChange = (open: boolean) => {
        setImportModalOpen(open)
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
                    <span className="text-xs text-muted-foreground">
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
                        <span className="text-xs font-mono font-bold w-10 text-right">
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
                    onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('selected', String(item.id))
                        router.push(`${pathname}?${params.toString()}`, { scroll: false })
                    }}
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
                isLoading={isLoading}
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
                initialColumnFilters={initialFilters}
                useAdvancedFilter={true}
                defaultPageSize={10}
                createAction={createAction}
            />

            <StatementImportModal
                open={importModalOpen}
                onOpenChange={handleModalChange}
                onSuccess={handleImportSuccess}
            />
        </>
    )
}
