"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"
import { Printer, Download, Calculator, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBranding } from "@/contexts/BrandingProvider"
import { SheetCloseButton } from "@/components/shared"
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
    sales_by_category?: Array<{ name: string, value: number }>
    generated_at?: string
    user_name?: string
}

interface POSReportProps {
    data: POSReportData
    title?: string
    type?: "X" | "Z"
    onClose?: () => void
}

export function POSReport({ data, title, type = "X", onClose }: POSReportProps) {
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

    const totalInflows = data.total_manual_inflow || 0
    const totalOutflows = data.total_manual_outflow || 0
    const calculatedExpected = Number(data.opening_balance || 0) + Number(data.total_cash_sales || 0) + Number(totalInflows) - Number(totalOutflows)

    return (
        <div ref={reportRef} className={cn(
            "w-full max-w-[380px] mx-auto bg-card p-6 shadow-overlay border border-border/50 text-card-foreground font-sans relative rounded-md animate-in zoom-in-95 duration-200",
            "print:shadow-none print:border-none print:p-0 print:w-[80mm]"
        )}>
            {/* Close Button */}
            {onClose && (
                <SheetCloseButton
                    onClick={onClose}
                    className="absolute -top-2 -right-2 bg-card shadow-floating border border-border/20 hover:bg-accent text-foreground print:hidden z-10"
                />
            )}


            {/* Header */}
            <div className="text-center space-y-1 mb-6 border-b-2 border-border/50 pb-4 flex flex-col items-center">
                {logo && (
                    <div className="mb-2">
                        <img src={logo} alt="Logo" className="max-h-16 object-contain" />
                    </div>
                )}
                <h1 className="text-sm font-black uppercase tracking-widest leading-tight">
                    {title || (type === 'Z' ? 'Informe de Cierre de Caja' : 'Informe Parcial de Caja')}
                </h1>
                <div className="flex justify-center items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">Sesión #{data.session_id}</span>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground/40">•</span>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">{data.user_name || 'Sistema'}</span>
                </div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-2">{new Date().toLocaleString()}</p>
            </div>

            {/* SECCIÓN A: CONTROL DE EFECTIVO */}
            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 border-b border-border pb-1">
                    <Calculator className="h-3 w-3 text-foreground" />
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-foreground">Control de Efectivo</h4>
                </div>

                <div className="space-y-2 text-[11px] leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground">Fondo Inicial:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.opening_balance)}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground">(+) Ventas Efectivo:</span>
                        <span className="font-black font-mono">+{formatCurrency(data.total_cash_sales)}</span>
                    </div>

                    {totalInflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold uppercase text-muted-foreground">(+) Otros Depósitos:</span>
                            <span className="font-black font-mono">+{formatCurrency(totalInflows)}</span>
                        </div>
                    )}

                    {totalOutflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold uppercase text-muted-foreground">(-) Retiros / Gastos:</span>
                            <span className="font-black font-mono text-destructive">-{formatCurrency(totalOutflows)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-border/30 mt-1">
                        <span className="font-black text-xs uppercase tracking-tight">Efectivo Esperado:</span>
                        <span className="font-black text-xl font-mono tracking-tighter">{formatCurrency(calculatedExpected)}</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN B: DESGLOSE DE PAGOS */}
            <div className="space-y-4 pt-4 border-t-2 border-border/50">
                <div className="flex items-center gap-2 border-b border-border pb-1">
                    <CreditCard className="h-3 w-3 text-foreground" />
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-foreground">Desglose de Pagos</h4>
                </div>

                <div className="space-y-1.5 text-[11px] leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground">Efectivo:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_cash_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground/80">Tarjeta:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_card_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground/80">Transferencia:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_transfer_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground/80">Crédito:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_credit_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-muted-foreground/80">Cheque:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_check_sales)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-border/30 mt-1">
                        <span className="font-black text-xs uppercase tracking-tight">Total Ventas:</span>
                        <span className="font-black text-xl font-mono tracking-tighter">{formatCurrency(data.total_sales)}</span>
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex justify-center gap-3 print:hidden">
                <Button
                    onClick={handlePrint}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-sm shadow-elevated border-2 border-primary/20"
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
                <Button
                    onClick={handleDownloadPdf}
                    variant="outline"
                    className="font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-sm"
                >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                </Button>
            </div>
        </div>
    )
}
