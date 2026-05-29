"use client"

import { useState, useEffect } from "react"
import { financeApi } from "../../api/financeApi"
import { DataCell, DataTable, EmptyState, SkeletonShell } from '@/components/shared'

import {formatPlainDate} from "@/lib/utils"
import type { ColumnDef } from "@tanstack/react-table"

interface SimulationResult {
    line: {
        description: string;
        date: string;
        amount: number | string;
    };
    payment: {
        partner?: string;
        reference?: string;
        amount: number | string;
    };
    score: number;
}

export function SimulationResults({ rule }: { rule: Record<string, unknown> }) {
    const [results, setResults] = useState<SimulationResult[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const simulate = async () => {
            setLoading(true)
            try {
                // Prepare rule data for backend
                const payload = {
                    ...(rule as any),
                    treasury_account_id: (rule as any).treasury_account?.id
                }
                const response = await financeApi.simulateRule(payload)
                setResults((response as any).results)
            } catch (error) {
                console.error("Simulation error", error)
            } finally {
                setLoading(false)
            }
        }
        simulate()
    }, [rule])

    if (loading) return <SkeletonShell isLoading ariaLabel="Cargando..." />

    if (results.length === 0) {
        return <EmptyState context="search" variant="compact" title="Sin coincidencias" description="Ninguna línea reciente coincide con esta configuración." />
    }

    const columns: ColumnDef<SimulationResult>[] = [
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
                            {Number(row.original.line.amount).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
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
                            {Number(row.original.payment.amount).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
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
        <div className="border rounded-sm border-border/40">
            <DataTable
                columns={columns}
                data={results}
                variant="embedded"
                hidePagination
            />
        </div>
    )
}
