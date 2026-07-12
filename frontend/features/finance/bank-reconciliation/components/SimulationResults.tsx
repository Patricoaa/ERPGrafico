"use client"

import { DataCell, DataTable, EmptyState, MoneyDisplay, SkeletonShell } from '@/components/shared'
import { useSimulationQuery } from "../hooks/useReconciliationQueries"

import {formatPlainDate} from "@/lib/utils"
import type { ColumnDef } from "@tanstack/react-table"

export function SimulationResults({ rule }: { rule: Record<string, unknown> }) {
    const { data: results, isLoading, isError } = useSimulationQuery(rule)

    if (isLoading) return <SkeletonShell isLoading ariaLabel="Cargando..." />

    if (isError) {
        return <EmptyState context="finance" variant="compact" title="Error de simulación" description="No se pudieron simular las reglas." />
    }

    if (!results || results.length === 0) {
        return <EmptyState context="search" variant="compact" title="Sin coincidencias" description="Ninguna línea reciente coincide con esta configuración." />
    }

    const columns: ColumnDef<typeof results[number]>[] = [
        {
            header: "Línea Banco",
            cell: ({ row }) => (
                <div className="flex flex-col items-start justify-start text-left w-full gap-0.5">
                    <DataCell.Text className="text-left justify-start font-black text-foreground/80">
                        {row.original.line.description}
                    </DataCell.Text>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {formatPlainDate(row.original.line.date)} •{" "}
                        <span className="font-bold text-foreground/60">
                            <MoneyDisplay amount={row.original.line.amount} inline className="text-[10px]" />
                        </span>
                    </div>
                </div>
            ),
        },
        {
            header: "Coincidencia Sistema",
            cell: ({ row }) => (
                <div className="flex flex-col items-start justify-start text-left w-full gap-0.5">
                    <DataCell.Text className="text-left justify-start font-black text-foreground/80">
                        {row.original.payment.partner || 'Concepto General'}
                    </DataCell.Text>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        Ref: <span className="font-bold">{row.original.payment.reference || 'N/A'}</span> •{" "}
                        <span className="font-bold">
                            <MoneyDisplay amount={row.original.payment.amount} inline className="text-[10px]" />
                        </span>
                    </div>
                </div>
            ),
        },
        {
            header: "Score",
            cell: ({ row }) => {
                const score = Math.round(row.original.score)
                const intent = score >= 90 ? "success" : score >= 70 ? "warning" : "neutral"
                return (
                    <div className="flex justify-end w-full">
                        <DataCell.Chip intent={intent} size="xs" className="w-fit font-mono font-black">
                            {score}%
                        </DataCell.Chip>
                    </div>
                )
            },
            meta: { align: "right" as const },
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={results}
            variant="minimal"
            hidePagination
        />
    )
}
