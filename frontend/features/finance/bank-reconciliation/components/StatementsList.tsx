"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Eye, Upload } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import type { BankStatement } from "../types"
import { StatementImportModal } from "@/features/treasury"
import { DataTable, StatusBadge, SmartSearchBar, SegmentationBar, useClientSearch, useSegmentation } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, DataCell } from '@/components/shared'
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { SearchDefinition } from '@/types/search'
import type { SegmentationDefinition } from '@/types/segmentation'

const statementsSearchDef: SearchDefinition = {
    fields: [
        {
            key: 'display_id',
            label: 'Cartola',
            type: 'text',
            serverParam: 'search',
            clientKey: ['display_id', 'treasury_account_name'],
        },
    ],
}

const statementsSegDef: SegmentationDefinition = {
    segments: [
        {
            key: 'state',
            label: 'Estado',
            type: 'tabs',
            serverParam: 'state',
            options: [
                { label: 'Borrador', value: 'DRAFT' },
                { label: 'Confirmado', value: 'CONFIRMED' },
                { label: 'Anulado', value: 'CANCELLED' },
            ],
        },
    ],
}

interface StatementsListProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
    bankId?: number
    accounts?: Array<{ id: number; name: string }>
    detailBasePath?: string
}

export function StatementsList({ externalOpen = false, createAction, bankId, accounts, detailBasePath }: StatementsListProps) {
    const statementDetailUrl = (id: number) => detailBasePath ? `${detailBasePath}/${id}` : `/treasury/reconciliation/${id}`
    const router = useRouter()
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
    const [importModalOpen, setImportModalOpen] = useState(false)

    const { filterFn, isFiltered: isTextFiltered } = useClientSearch<BankStatement>(statementsSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered } = useSegmentation(statementsSegDef)
    const isFiltered = isTextFiltered || isSegFiltered

    const { data: statements = [], isLoading, refetch } = useStatementsQuery(
        selectedAccountId
            ? { treasury_account: String(selectedAccountId) }
            : bankId
            ? { bank: String(bankId) }
            : undefined,
    )

    const filteredStatements = useMemo(() => {
        let result = filterFn(statements)
        if (segFilters.state) {
            result = result.filter((s) => s.state === segFilters.state)
        }
        return result
    }, [filterFn, statements, segFilters])

    const { entity: selectedFromUrl } = useSelectedEntity<BankStatement>({
        endpoint: '/treasury/statements'
    })

    // Handle deep-linked statement selection (ADR-0020)
    useEffect(() => {
        if (selectedFromUrl) {
            router.replace(statementDetailUrl(selectedFromUrl.id))
        }
    }, [selectedFromUrl, router])

    // Open import dialog when triggered via URL (?modal=import)
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setImportModalOpen(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    const handleImportSuccess = () => {
        refetch()
        setImportModalOpen(false)
        if (!accounts) {
            router.replace('/treasury/reconciliation')
        }
    }

    const handleModalChange = (open: boolean) => {
        setImportModalOpen(open)
        if (!open && !accounts) {
            router.replace('/treasury/reconciliation')
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
                        router.push(statementDetailUrl(item.id))
                    }}
                />
            )
        })
    ]

    const accountFilter = accounts !== undefined ? (
        accounts.length > 0 ? (
            <Select
                value={selectedAccountId?.toString() || 'all'}
                onValueChange={(v) => setSelectedAccountId(v === 'all' ? null : Number(v))}
            >
                <SelectTrigger className="h-7 w-[180px] shrink-0 text-[10px] font-black uppercase tracking-widest">
                    <SelectValue placeholder="Todas las cuentas" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-[10px] font-bold uppercase">Todas las cuentas</SelectItem>
                    {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id.toString()} className="text-[10px] font-bold uppercase">
                            {acc.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        ) : (
            <div className="h-7 flex items-center px-3 rounded-md border border-border/50 bg-muted/20 shrink-0 gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Sin cuentas bancarias</span>
            </div>
        )
    ) : null

    const internalImportButton = accounts !== undefined ? (
        <Button
            className="h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-widest shadow-card bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setImportModalOpen(true)}
        >
            <Upload className="h-3.5 w-3.5 mr-2" />
            Importar Cartola
        </Button>
    ) : undefined

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={filteredStatements}
                    variant="embedded"
                    isLoading={isLoading}
                    isFiltered={isFiltered}
                    customFilters={accountFilter}
                    smartSearch={<SmartSearchBar searchDef={statementsSearchDef} placeholder="Buscar por ID o cuenta..." className="flex-1" />}
                    segmentation={<SegmentationBar def={statementsSegDef} />}
                    createAction={internalImportButton ?? createAction}
                    defaultPageSize={10}
                />
            </div>

            <StatementImportModal
                open={importModalOpen}
                onOpenChange={handleModalChange}
                onSuccess={handleImportSuccess}
                defaultAccountId={selectedAccountId || undefined}
                allowedAccountIds={accounts?.map(a => a.id)}
            />
        </div>
    )
}
