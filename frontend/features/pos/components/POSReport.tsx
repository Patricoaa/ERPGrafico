"use client"

import { useState, useMemo } from "react"

import { Separator } from "@/components/ui/separator"
import { formatCurrency, cn } from "@/lib/utils"
import { Printer, Calculator, TrendingUp, X, Activity, CreditCard, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBranding } from "@/contexts/BrandingProvider"

interface POSReportProps {
    data: {
        session_id: number
        treasury_account_id?: number
        opening_balance: number
        total_cash_sales: number
        total_card_sales: number
        total_transfer_sales: number
        total_credit_sales: number
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
    title?: string
    type?: "X" | "Z"
    onClose?: () => void
}

export function POSReport({ data, title, type = "X", onClose }: POSReportProps) {
    const { logo } = useBranding()

    // Calcular totales para validación visual
    const totalInflows = data.total_manual_inflow || 0
    const totalOutflows = data.total_manual_outflow || 0
    const calculatedExpected = Number(data.opening_balance || 0) + Number(data.total_cash_sales || 0) + Number(totalInflows) - Number(totalOutflows)

    const handlePrint = () => {
        const printContent = document.getElementById('pos-report-printable');
        if (!printContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
            // Copy parent styles
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(s => s.outerHTML)
                .join('\n');
            
            iframeDoc.open();
            iframeDoc.write(`
                <html>
                    <head>
                        <title>Imprimir Comprobante</title>
                        ${styles}
                        <style>
                            /* Hide the print button in the print view */
                            .print\\\\:hidden { display: none !important; }
                            @page { margin: 0; }
                            body { margin: 10px; padding: 0; background: white; }
                        </style>
                    </head>
                    <body>
                        ${printContent.outerHTML}
                    </body>
                </html>
            `);
            iframeDoc.close();

            // Wait for styles to load before printing
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 500);
        }
    };

    return (
        <div id="pos-report-printable" className={cn(
            "w-full max-w-[380px] mx-auto bg-white p-6 shadow-2xl border border-black/5 text-black font-sans relative rounded-2xl animate-in zoom-in-95 duration-200",
            "print:shadow-none print:border-none print:p-0 print:w-[80mm]"
        )}>
            {/* Close Button */}
            {onClose && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-lg border border-black/10 hover:bg-black/5 print:hidden group z-10"
                >
                    <X className="h-4 w-4 text-black group-hover:scale-110 transition-transform" />
                </Button>
            )}

            {/* Header */}
            <div className="text-center space-y-1 mb-6 border-b-2 border-black pb-4 flex flex-col items-center">
                {logo && (
                    <div className="mb-2">
                        <img src={logo} alt="Logo" className="max-h-16 object-contain" />
                    </div>
                )}
                <h1 className="text-sm font-black uppercase tracking-widest leading-tight">
                    {title || (type === 'Z' ? 'Informe de Cierre de Caja' : 'Informe Parcial de Caja')}
                </h1>
                <div className="flex justify-center items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono font-bold text-black/70">Sesión #{data.session_id}</span>
                    <span className="text-[10px] font-mono font-bold text-black/40">•</span>
                    <span className="text-[10px] font-mono font-bold text-black/70">{data.user_name || 'Sistema'}</span>
                </div>
                <p className="text-[10px] font-bold uppercase text-black/70 mt-2">{new Date().toLocaleString()}</p>
            </div>

            {/* SECCIÓN A: CONTROL DE EFECTIVO */}
            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 border-b border-black/10 pb-1">
                    <Calculator className="h-3 w-3 text-black" />
                    <h4 className="font-black text-[10px] uppercase tracking-widest">Control de Efectivo</h4>
                </div>

                <div className="space-y-2 text-[11px] leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/70">Fondo Inicial:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.opening_balance)}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/70">(+) Ventas Efectivo:</span>
                        <span className="font-black font-mono">+{formatCurrency(data.total_cash_sales)}</span>
                    </div>

                    {totalInflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold uppercase text-black/70">(+) Otros Depósitos:</span>
                            <span className="font-black font-mono">+{formatCurrency(totalInflows)}</span>
                        </div>
                    )}

                    {totalOutflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold uppercase text-black/70">(-) Retiros / Gastos:</span>
                            <span className="font-black font-mono text-destructive">-{formatCurrency(totalOutflows)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-black/30 mt-1">
                        <span className="font-black text-xs uppercase tracking-tight">Efectivo Esperado:</span>
                        <span className="font-black text-xl font-mono tracking-tighter">{formatCurrency(calculatedExpected)}</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN B: DESGLOSE DE PAGOS */}
            <div className="space-y-4 pt-4 border-t-2 border-black">
                <div className="flex items-center gap-2 border-b border-black/10 pb-1">
                    <CreditCard className="h-3 w-3 text-black" />
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-black">Desglose de Pagos</h4>
                </div>

                <div className="space-y-1.5 text-[11px] leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/70">Efectivo:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_cash_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Tarjeta:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_card_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Transferencia:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_transfer_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Crédito:</span>
                        <span className="font-bold font-mono">{formatCurrency(data.total_credit_sales)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-black/30 mt-1">
                        <span className="font-black text-xs uppercase tracking-tight">Total Ventas:</span>
                        <span className="font-black text-xl font-mono tracking-tighter">{formatCurrency(data.total_sales)}</span>
                    </div>
                </div>
            </div>

            {/* Print button inside preview */}
            <div className="mt-6 flex justify-center print:hidden">
                <Button 
                    onClick={handlePrint} 
                    className="bg-black text-white hover:bg-black/90 font-black uppercase tracking-widest text-[10px] h-10 px-8 rounded-xl shadow-lg border-2 border-black"
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Informe
                </Button>
            </div>
        </div>
    )
}
