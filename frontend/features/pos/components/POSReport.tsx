"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"
import { Printer, Download, Calculator, CreditCard, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBranding } from "@/contexts/BrandingProvider"
import { DataCell, SheetCloseButton } from "@/components/shared"
import { toast } from "sonner"
import { useDownloadPOSReportPDF } from "../hooks/usePOSSessions"

export interface POSReportData {
    session_id: number
    treasury_account_id?: number
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_check_sales: number
    total_sales: number
    expected_cash: number
    total_manual_inflow?: number
    total_manual_outflow?: number
    manual_movements?: Array<{
        id: number
        amount: string | number
        movement_type: string
        movement_type_display: string
        notes: string
        created_at: string
        justify_reason?: string
        to_account?: number
        from_account?: number
    }>
    /** ADR-0109: true si el efectivo esperado sale del libro de caja (movimientos de la cuenta). */
    cash_ledger_mode?: boolean
    cash_breakdown?: POSCashBreakdown | null
    out_of_session_movements?: POSOutOfSessionMovement[]
    total_card_terminal_sales?: number
    sales_by_category?: Array<{ name: string, value: number }>
    sale_order_count?: number
    dte_breakdown?: Array<{ dte_type: string, count: number }>
    generated_at?: string
    user_name?: string
    terminal_name?: string
    opened_at?: string
    closed_at?: string
}

type Amount = number | string

export interface POSCashBreakdown {
    cash_sales: Amount
    cash_refunds: Amount
    manual_inflow: Amount
    manual_outflow: Amount
    external_inflow: Amount
    external_outflow: Amount
    /** Neto con signo de las anulaciones hechas durante la sesión. */
    annulments: Amount
    net: Amount
}

export interface POSOutOfSessionMovement {
    id: number
    display_id: string
    event: "EXTERNAL" | "ANNULMENT"
    direction: "IN" | "OUT"
    amount: Amount
    at: string
    document: string
    contact_name: string
    notes: string
    reason: string
    created_by_name: string
}

interface POSReportProps {
    data: POSReportData
    title?: string
    type?: "X" | "Z"
    onClose?: () => void
    loading?: boolean
}

function formatSessionTime(openedAt?: string, closedAt?: string): string {
    if (!openedAt) return ""
    const d = new Date(openedAt)
    const datePart = d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
    const timePart = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })
    if (!closedAt) return `${datePart}  ${timePart}`
    const endTime = new Date(closedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })
    return `${datePart}  ${timePart} - ${endTime}`
}

function sentenceCase(str: string): string {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLocaleLowerCase("es-CL")
}

export function POSReport({ data, title, type = "X", onClose, loading = false }: POSReportProps) {
    const { logo } = useBranding()
    const reportRef = useRef<HTMLDivElement>(null)
    const { downloadPdf } = useDownloadPOSReportPDF()

    const handlePrint = useReactToPrint({
        contentRef: reportRef,
        documentTitle: title || `Informe POS ${type}`,
    })

    const handleDownloadPdf = async () => {
        try {
            await downloadPdf(data.session_id, type)
            toast.success("PDF descargado correctamente")
        } catch {
            toast.error("Error al descargar el PDF")
        }
    }

    const totalInflows = Number(data.total_manual_inflow || 0)
    const totalOutflows = Number(data.total_manual_outflow || 0)
    const breakdown = data.cash_breakdown ?? null
    const cashSales = Number(breakdown ? breakdown.cash_sales : data.total_cash_sales || 0)
    const cashRefunds = Number(breakdown?.cash_refunds || 0)
    const externalInflow = Number(breakdown?.external_inflow || 0)
    const externalOutflow = Number(breakdown?.external_outflow || 0)
    const annulments = Number(breakdown?.annulments || 0)
    const outOfSession = data.out_of_session_movements ?? []

    return (
        <div ref={reportRef} className={cn(
            // card-family-allow: printed receipt (80mm ticket), not a card
            "w-full max-w-[380px] mx-auto bg-card p-6 shadow-overlay border border-border/50 text-card-foreground font-sans relative rounded-md animate-in zoom-in-95 duration-200 motion-reduce:animate-none",
            "print:shadow-none print:border-none print:p-0 print:w-[80mm]"
        )}>
            {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/60 rounded-md animate-pulse motion-reduce:animate-none print:hidden">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce motion-reduce:animate-none" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce motion-reduce:animate-none" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce motion-reduce:animate-none" style={{ animationDelay: "300ms" }} />
                    </div>
                </div>
            )}
            {/* Close Button */}
            {onClose && (
                <SheetCloseButton
                    onClick={onClose}
                    className="absolute -top-2 -right-2 bg-card shadow-floating border border-border/20 hover:bg-accent text-foreground print:hidden z-10"
                />
            )}


            {/* Header */}
            <div className="text-center space-y-1 mb-6 flex flex-col items-center">
                {logo && (
                    <div className="mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- print/PDF context */}
                        <img src={logo} alt="Logo" className="max-h-16 object-contain" />
                    </div>
                )}
                <h1 className="text-sm font-black uppercase tracking-widest leading-tight">
                    {title || (type === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)')}
                </h1>
                <div className="flex justify-center items-center gap-2 mt-1">
                    <span className="text-2xs font-mono font-bold text-muted-foreground">Sesión #{data.session_id}</span>
                    <span className="text-2xs font-mono font-bold text-muted-foreground/40">•</span>
                    <span className="text-2xs font-mono font-bold text-muted-foreground">{data.user_name || 'Sistema'}</span>
                </div>
                {data.terminal_name && (
                    <p className="text-2xs font-bold text-muted-foreground">{data.terminal_name}</p>
                )}
                <p className="text-2xs font-bold text-muted-foreground">{formatSessionTime(data.opened_at, data.closed_at)}</p>
            </div>

            {/* SECCIÓN A: CONTROL DE CAJA */}
            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 pb-1.5 border-b border-border">
                    <Calculator className="h-3 w-3 text-foreground" />
                    <h4 className=" font-black text-xs uppercase tracking-widest text-foreground">Control de Sesión</h4>
                </div>

                <div className="space-y-1.5 text-2xs leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold text-muted-foreground">Fondo inicial:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.opening_balance)}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="font-bold text-muted-foreground">(+) Efectivo de ventas:</span>
                        <DataCell.CurrencyFlow value={cashSales} direction="inflow" showIcon={false} className="font-bold text-2xs font-mono" />
                    </div>

                    {cashRefunds > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold text-muted-foreground">(-) Devoluciones en efectivo:</span>
                            <DataCell.CurrencyFlow value={cashRefunds} direction="outflow" showIcon={false} className="font-black" />
                        </div>
                    )}

                    {totalInflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold text-muted-foreground">(+) Depósitos manuales:</span>
                            <DataCell.CurrencyFlow value={totalInflows} direction="inflow" showIcon={false} className="font-black" />
                        </div>
                    )}

                    {totalOutflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold text-muted-foreground">(-) Retiros / gastos:</span>
                            <DataCell.CurrencyFlow value={totalOutflows} direction="outflow" showIcon={false} className="font-black" />
                        </div>
                    )}

                    {externalInflow > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold text-muted-foreground">(+) Ingresos fuera de la sesión:</span>
                            <DataCell.CurrencyFlow value={externalInflow} direction="inflow" showIcon={false} className="font-black" />
                        </div>
                    )}

                    {externalOutflow > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold text-muted-foreground">(-) Egresos fuera de la sesión:</span>
                            <DataCell.CurrencyFlow value={externalOutflow} direction="outflow" showIcon={false} className="font-black" />
                        </div>
                    )}

                    {annulments !== 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold text-muted-foreground">(±) Anulaciones:</span>
                            <DataCell.CurrencyFlow
                                value={Math.abs(annulments)}
                                direction={annulments > 0 ? "inflow" : "outflow"}
                                showIcon={false}
                                className="font-black"
                            />
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-border/30 mt-1">
                        <span className="font-bold text-2xs uppercase tracking-tight">Efectivo Esperado:</span>
                        <span className="font-bold text-sm font-mono tracking-tighter">{formatCurrency(Number(data.expected_cash || 0))}</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN A2: MOVIMIENTOS FUERA DE LA SESIÓN (ADR-0109) */}
            {outOfSession.length > 0 && (
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-border">
                        <AlertTriangle className="h-3 w-3 text-warning" />
                        <h4 className=" font-black text-xs uppercase tracking-widest text-foreground">Fuera de la Sesión</h4>
                    </div>
                    <ul className="space-y-2 text-2xs leading-tight">
                        {outOfSession.map((mv) => (
                            <li key={`${mv.event}-${mv.id}`} className="space-y-0.5">
                                <div className="flex justify-between gap-2">
                                    <span className="font-bold text-muted-foreground">
                                        {mv.event === "ANNULMENT" ? "Anulación " : ""}{mv.display_id}
                                        {mv.document ? ` · ${mv.document}` : ""}
                                    </span>
                                    <DataCell.CurrencyFlow
                                        value={Number(mv.amount)}
                                        direction={mv.direction === "IN" ? "inflow" : "outflow"}
                                        showIcon={false}
                                        className="font-black text-2xs font-mono"
                                    />
                                </div>
                                {(mv.reason || mv.notes || mv.created_by_name) && (
                                    <p className="text-muted-foreground">
                                        {[mv.created_by_name, mv.reason || mv.notes].filter(Boolean).join(" — ")}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* SECCIÓN B: VENTAS */}
            {data.total_sales > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-border">
                        <CreditCard className="h-3 w-3 text-foreground" />
                        <h4 className=" font-black text-xs uppercase tracking-widest text-foreground">Ventas</h4>
                    </div>

                    <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Por Método de Pago</div>
                    <div className="space-y-1.5 text-2xs leading-tight mb-4">
                        {data.total_cash_sales > 0 && (
                            <div className="flex justify-between">
                                <span className="font-bold text-muted-foreground">Efectivo:</span>
                                <span className="font-bold font-mono">{formatCurrency(data.total_cash_sales)}</span>
                            </div>
                        )}
                        {data.total_card_terminal_sales !== undefined ? (
                            <>
                                {(data.total_card_sales - data.total_card_terminal_sales) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="font-bold text-muted-foreground">Tarjeta:</span>
                                        <span className="font-bold font-mono">{formatCurrency((data.total_card_sales || 0) - data.total_card_terminal_sales)}</span>
                                    </div>
                                )}
                                {data.total_card_terminal_sales > 0 && (
                                    <div className="flex justify-between">
                                        <span className="font-bold text-muted-foreground">Tarjeta (terminal de cobro):</span>
                                        <span className="font-bold font-mono">{formatCurrency(data.total_card_terminal_sales)}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            data.total_card_sales > 0 && (
                                <div className="flex justify-between">
                                    <span className="font-bold text-muted-foreground">Tarjeta:</span>
                                    <span className="font-bold font-mono">{formatCurrency(data.total_card_sales)}</span>
                                </div>
                            )
                        )}
                        {data.total_transfer_sales > 0 && (
                            <div className="flex justify-between">
                                <span className="font-bold text-muted-foreground">Transferencia:</span>
                                <span className="font-bold font-mono">{formatCurrency(data.total_transfer_sales)}</span>
                            </div>
                        )}
                        {data.total_credit_sales > 0 && (
                            <div className="flex justify-between">
                                <span className="font-bold text-muted-foreground">Crédito:</span>
                                <span className="font-bold font-mono">{formatCurrency(data.total_credit_sales)}</span>
                            </div>
                        )}
                        {data.total_check_sales > 0 && (
                            <div className="flex justify-between">
                                <span className="font-bold text-muted-foreground">Cheque:</span>
                                <span className="font-bold font-mono">{formatCurrency(data.total_check_sales)}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-1 border-t border-dashed border-border/30 mt-1">
                            <span className="font-bold text-2xs uppercase tracking-tight">Total Ventas:</span>
                            <span className="font-black text-sm font-mono tracking-tighter">{formatCurrency(data.total_sales)}</span>
                        </div>
                    </div>

                    {data.sale_order_count !== undefined && (
                        <>
                            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Por Documentos Emitidos</div>
                            <div className="space-y-1.5 text-2xs leading-tight mb-4">
                                {data.sale_order_count > 0 && (
                                    <div className="flex justify-between">
                                        <span className="font-bold text-muted-foreground">Ordenes de venta:</span>
                                        <span className="font-bold font-mono">{data.sale_order_count}</span>
                                    </div>
                                )}
                                {data.dte_breakdown && data.dte_breakdown.length > 0 && data.dte_breakdown.map((dte) => (
                                    <div key={dte.dte_type} className="flex justify-between">
                                        <span className="font-bold text-muted-foreground">{sentenceCase(dte.dte_type)}:</span>
                                        <span className="font-bold font-mono">{dte.count}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex justify-center gap-3 print:hidden">
                <Button
                    onClick={handlePrint}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium uppercase tracking-widest text-3xs h-10 px-6 rounded-sm shadow-elevated border-2 border-primary/20"
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
                <Button
                    onClick={handleDownloadPdf}
                    variant="outline"
                    className="font-medium uppercase tracking-widest text-3xs h-10 px-6 rounded-sm"
                >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                </Button>
            </div>
        </div>
    )
}
