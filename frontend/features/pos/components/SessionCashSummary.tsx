"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { cn, formatTimeWith } from "@/lib/utils"
import { useDownloadPOSReportPDF } from "../hooks/usePOSSessions"
import type { POSReportData } from "./POSReport"

interface SessionCashSummaryProps {
    /** Resumen de la sesión (ADR-0126, en vivo). `null` mientras carga. */
    data: POSReportData | null
    /** Efectivo esperado vigente (fuente: backend, ADR-0109). */
    expected: number
    sessionId: number
    className?: string
}

type Line = { label: string; amount: number; sign: "+" | "−" | "±" }

/**
 * Informe de la sesión integrado en el conteo del cierre: de dónde sale el efectivo esperado y
 * cuánto se vendió por método. No es el ticket impreso: el informe Z completo se exporta a PDF.
 */
export function SessionCashSummary({ data, expected, sessionId, className }: SessionCashSummaryProps) {
    const { downloadPdf } = useDownloadPOSReportPDF()
    const [downloading, setDownloading] = useState(false)

    const handlePdf = async () => {
        setDownloading(true)
        try {
            await downloadPdf(sessionId, "Z")
        } catch {
            toast.error("No se pudo descargar el PDF del informe")
        } finally {
            setDownloading(false)
        }
    }

    const b = data?.cash_breakdown ?? null
    const n = (v: number | string | null | undefined) => Number(v || 0)
    const annulments = n(b?.annulments)
    const cashLines: Line[] = data ? [
        { label: "Efectivo de ventas", amount: n(b ? b.cash_sales : data.total_cash_sales), sign: "+" as const },
        { label: "Devoluciones en efectivo", amount: n(b?.cash_refunds), sign: "−" as const },
        { label: "Depósitos manuales", amount: n(data.total_manual_inflow), sign: "+" as const },
        { label: "Retiros y gastos", amount: n(data.total_manual_outflow), sign: "−" as const },
        { label: "Ingresos fuera de la sesión", amount: n(b?.external_inflow), sign: "+" as const },
        { label: "Egresos fuera de la sesión", amount: n(b?.external_outflow), sign: "−" as const },
        { label: "Anulaciones", amount: Math.abs(annulments), sign: annulments >= 0 ? "+" as const : "−" as const },
    ].filter(l => l.amount !== 0) : []

    const salesByMethod = data ? [
        { label: "Efectivo", amount: n(data.total_cash_sales) },
        { label: "Tarjeta", amount: n(data.total_card_sales) },
        { label: "Transferencia", amount: n(data.total_transfer_sales) },
        { label: "Crédito", amount: n(data.total_credit_sales) },
        { label: "Cheque", amount: n(data.total_check_sales) },
    ].filter(m => m.amount > 0) : []

    return (
        <section aria-label="Resumen de la sesión" className={cn("surface-panel flex flex-col shadow-card", className)}>
            <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold">Resumen de la sesión</h2>
                    <p className="truncate text-sm text-muted-foreground">
                        Sesión #{sessionId}
                        {data?.opened_at ? ` · abierta ${formatTimeWith(data.opened_at)}` : ""}
                        {data?.sale_order_count !== undefined ? ` · ${data.sale_order_count} ${data.sale_order_count === 1 ? "venta" : "ventas"}` : ""}
                    </p>
                </div>
                <Button variant="outline" className="h-12 shrink-0 gap-2 px-4 text-base" onClick={() => void handlePdf()} disabled={downloading}>
                    <Download className="size-5" aria-hidden />
                    PDF
                </Button>
            </header>

            {!data ? (
                <div className="space-y-3 p-6" role="status" aria-label="Cargando resumen">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <div className="divide-y divide-border px-6">
                    <dl className="space-y-2 py-4 text-base">
                        <div className="flex items-baseline justify-between gap-4">
                            <dt className="text-muted-foreground">Fondo inicial</dt>
                            <dd className="font-mono tabular-nums">{formatCurrency(n(data.opening_balance))}</dd>
                        </div>
                        {cashLines.map(l => (
                            <div key={l.label} className="flex items-baseline justify-between gap-4">
                                <dt className="text-muted-foreground">{l.sign} {l.label}</dt>
                                <dd className="font-mono tabular-nums">{formatCurrency(l.amount)}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="flex items-baseline justify-between gap-4 py-4">
                        <span className="text-xl font-bold">Efectivo esperado</span>
                        <span className="font-mono text-3xl font-black tabular-nums">{formatCurrency(expected)}</span>
                    </div>
                    {salesByMethod.length > 0 && (
                        <div className="py-4">
                            <div className="mb-2 flex items-baseline justify-between gap-4">
                                <span className="text-base font-semibold">Ventas de la sesión</span>
                                <span className="font-mono text-base font-semibold tabular-nums">{formatCurrency(n(data.total_sales))}</span>
                            </div>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                {salesByMethod.map(m => (
                                    <div key={m.label} className="flex items-baseline justify-between gap-2">
                                        <dt className="text-muted-foreground">{m.label}</dt>
                                        <dd className="font-mono tabular-nums">{formatCurrency(m.amount)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
