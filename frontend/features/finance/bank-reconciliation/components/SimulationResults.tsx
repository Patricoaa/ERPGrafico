"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"

export function SimulationResults({ rule }: { rule: any }) {
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const simulate = async () => {
            setLoading(true)
            try {
                // Prepare rule data for backend
                const payload = {
                    ...rule,
                    treasury_account_id: rule.treasury_account?.id
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

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (results.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                No se encontraron coincidencias con esta configuración en las líneas recientes.
            </div>
        )
    }

    return (
        <div className="max-h-[400px] overflow-auto border rounded-sm border-border/40">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3">Línea Banco</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3">Coincidencia Sistema</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-3">Score</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((res, i) => (
                        <TableRow key={i} className="group transition-colors">
                            <TableCell className="py-3">
                                <div className="text-[11px] font-black uppercase tracking-tight text-foreground/80">{res.line.description}</div>
                                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                                    {formatPlainDate(res.line.date)} • <span className="font-bold text-foreground/60">${res.line.amount}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-3">
                                <div className="text-[11px] font-black uppercase tracking-tight text-foreground/80">{res.payment.partner || 'Concepto General'}</div>
                                <div className="text-[10px] font-mono text-muted-foreground mt-1">
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
