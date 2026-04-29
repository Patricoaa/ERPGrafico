"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { formatPlainDate, cn } from "@/lib/utils"

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
                const response = await api.post('/treasury/reconciliation-rules/simulate/', payload)
                setResults(response.data.results)
            } catch (error) {
                console.error("Simulation error", error)
            } finally {
                setLoading(false)
            }
        }
        simulate()
    }, [rule])

    if (loading) return <TableSkeleton rows={5} columns={3} className="p-8" />

    if (results.length === 0) {
        return <EmptyState context="search" variant="compact" title="Sin coincidencias" description="Ninguna línea reciente coincide con esta configuración." />
    }

    return (
        <div className="max-h-[400px] overflow-auto border rounded-sm border-border/40">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-black uppercase py-3">Línea Banco</TableHead>
                        <TableHead className="text-xs font-black uppercase py-3">Coincidencia Sistema</TableHead>
                        <TableHead className="text-right text-xs font-black uppercase py-3">Score</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((res, i) => (
                        <TableRow key={i} className="group transition-colors">
                            <TableCell className="py-3">
                                <div className="text-xs font-black uppercase text-foreground/80">{res.line.description}</div>
                                <div className="text-[10px] font-mono text-muted-foreground mt-1"> {/* intentional: badge density */}
                                    {formatPlainDate(res.line.date)} • <span className="font-bold text-foreground/60">${res.line.amount}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-3">
                                <div className="text-xs font-black uppercase text-foreground/80">{res.payment.partner || 'Concepto General'}</div>
                                <div className="text-[10px] font-mono text-muted-foreground mt-1"> {/* intentional: badge density */}
                                    Ref: <span className="font-bold">{res.payment.reference || 'N/A'}</span> • <span className="font-bold">${res.payment.amount}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right py-3">
                                <div className={cn(
                                    "inline-flex items-center justify-center h-7 px-2 font-mono font-black text-[12px] rounded-sm border",
                                    res.score >= 90 ? "bg-success/10 text-success border-success/20" :
                                    res.score >= 70 ? "bg-warning/10 text-warning border-warning/20" :
                                    "bg-muted/50 text-muted-foreground border-border/40"
                                )}>
                                    {Math.round(res.score)}%
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
