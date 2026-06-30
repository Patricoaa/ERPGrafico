"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { useStatementsQuery } from "../hooks/useReconciliationQueries"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import type { BankStatement } from "../types"
import { StatementImportModal } from "@/features/finance"
import { DataTableView, StatusBadge, SmartSearchBar, SegmentationBar, useClientSearch, useSegmentation, EntityCard, ToolbarCreateButton } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import type { ColumnDef } from "@tanstack/react-table"
import { DataCell } from '@/components/shared'
import { statementActions, type StatementActionsCtx } from './statementActions'
import { Progress } from "@/components/ui/progress"
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
    const [importModalOpen, setImportModalOpen] = useState(false)

    const { filterFn, isFiltered: isTextFiltered, clearAll: clearText } = useClientSearch<BankStatement>(statementsSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(statementsSegDef)
    const isFiltered = isTextFiltered || isSegFiltered
    const handleReset = useCallback(() => {
        clearText()
        clearSeg()
    }, [clearText, clearSeg])

    const { data: statements = [], isLoading, refetch } = useStatementsQuery(
        segFilters.account && segFilters.account !== 'all'
            ? { treasury_account: segFilters.account }
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

    const actionsCtx: StatementActionsCtx = {
        onView: (id) => router.push(statementDetailUrl(id)),
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
        statementActions.column(actionsCtx)
    ]

    const internalImportButton = accounts !== undefined ? (
        <ToolbarCreateButton
            label="Importar Cartola"
            icon={Upload}
            onClick={() => setImportModalOpen(true)}
        />
    ) : undefined

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.bankstatement"
                    columns={columns}
                    data={filteredStatements}
                    variant="embedded"
                    isLoading={isLoading}
                    isFiltered={isFiltered}
                    showReset={isFiltered}
                    onReset={handleReset}
                    smartSearch={<SmartSearchBar searchDef={statementsSearchDef} placeholder="Buscar cartola..." />}
                    segmentation={
                        <SegmentationBar def={{
                            ...statementsSegDef,
                            segments: [
                                ...statementsSegDef.segments,
                                ...(accounts ? [{
                                    key: 'account',
                                    label: 'Cuenta',
                                    type: 'tabs' as const,
                                    variant: 'dropdown' as const,
                                    serverParam: 'account',
                                    defaultValue: 'all',
                                    options: [
                                        { label: 'Todas las cuentas', value: 'all' },
                                        ...accounts.map(a => ({ label: a.name, value: String(a.id) })),
                                    ],
                                }] : []),
                            ],
                        }} />
                    }
                    createAction={internalImportButton ?? createAction}
                    defaultPageSize={10}
                    renderCard={(stmt: BankStatement) => (
                        <EntityCard key={stmt.id} onClick={() => router.push(statementDetailUrl(stmt.id))}>
                            <EntityCard.Header
                                title={stmt.display_id}
                                subtitle={stmt.treasury_account_name}
                                trailing={<StatusBadge status={stmt.state} label={stmt.state_display} />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Apertura" value={<DataCell.Currency value={stmt.opening_balance} />} />
                                <EntityCard.Field label="Cierre" value={<DataCell.Currency value={stmt.closing_balance} />} />
                                <EntityCard.Field label="Progreso" value={`${Math.round(parseFloat(String(stmt.reconciliation_progress)))}%`} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

            <StatementImportModal
                open={importModalOpen}
                onOpenChange={handleModalChange}
                onSuccess={handleImportSuccess}
                defaultAccountId={segFilters.account && segFilters.account !== 'all' ? Number(segFilters.account) : undefined}
                allowedAccountIds={accounts?.map(a => a.id)}
            />
        </div>
    )
}
