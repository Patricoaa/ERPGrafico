"use client"

import { formatCurrency } from "@/lib/money"
import type { LoanInstallment, LoanSchedulePreviewRow } from "@/types/hr"

type ScheduleRow = Pick<LoanSchedulePreviewRow, "number" | "year" | "month" | "principal" | "interest" | "amount"> & Partial<Pick<LoanInstallment, "status">>

interface LoanScheduleTableProps {
    rows: ScheduleRow[]
    emptyMessage?: string
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

/** Plan de cuotas de un préstamo: capital, interés y total por período (ADR-0156). */
export function LoanScheduleTable({ rows, emptyMessage = "Calcule las cuotas para ver el plan." }: LoanScheduleTableProps) {
    if (!rows.length) {
        return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    }
    return (
        <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">Período</th>
                        <th className="px-3 py-2 text-right font-medium">Capital</th>
                        <th className="px-3 py-2 text-right font-medium">Interés</th>
                        <th className="px-3 py-2 text-right font-medium">Cuota</th>
                        <th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.number} className="border-t border-border">
                            <td className="px-3 py-2">{row.number}</td>
                            <td className="px-3 py-2">{MONTHS[row.month - 1]} {row.year}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.principal)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.interest)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.status === "APPLIED" ? "Descontada" : row.status === "PENDING" ? "Pendiente" : ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
