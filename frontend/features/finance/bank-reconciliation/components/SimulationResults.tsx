"use client"

import { useState, useEffect } from "react"
import { financeApi } from "../../api/financeApi"
import { DataTable } from "@/components/shared"
import { SkeletonShell } from "@/components/shared"
import { EmptyState } from "@/components/shared/EmptyState"
import { formatPlainDate, cn } from "@/lib/utils"
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
                <div>
                    <div className="text-xs font-black uppercase text-foreground/80">{row.original.line.description}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        {formatPlainDate(row.original.line.date)} • <span className="font-bold text-foreground/60">${row.original.line.amount}</span>
                    </div>
                </div>
            ),
        },
        {
            header: "Coincidencia Sistema",
            cell: ({ row }) => (
                <div>
                    <div className="text-xs font-black uppercase text-foreground/80">{row.original.payment.partner || 'Concepto General'}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        Ref: <span className="font-bold">{row.original.payment.reference || 'N/A'}</span> • <span className="font-bold">${row.original.payment.amount}</span>
                    </div>
                </div>
            ),
        },
        {
            header: "Score",
            cell: ({ row }) => {
                const score = row.original.score
                return (
                    <div className={cn(
                        "inline-flex items-center justify-center h-7 px-2 font-mono font-black text-[12px] rounded-sm border",
                        score >= 90 ? "bg-success/10 text-success border-success/20" :
                        score >= 70 ? "bg-warning/10 text-warning border-warning/20" :
                        "bg-muted/50 text-muted-foreground border-border/40"
                    )}>
                        {Math.round(score)}%
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
