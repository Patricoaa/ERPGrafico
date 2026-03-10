"use client"

import { Separator } from "@/components/ui/separator"
import { formatCurrency, cn } from "@/lib/utils"
import { Printer, Calculator, TrendingUp, X } from "lucide-react"
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

export function POSReport({ data, title = "Informe de Caja", type = "X", onClose }: POSReportProps) {
    const { logo } = useBranding()

    // Calcular totales para validación visual
    const totalInflows = data.total_manual_inflow || 0
    const totalOutflows = data.total_manual_outflow || 0
    const calculatedExpected = data.opening_balance + data.total_cash_sales + totalInflows - totalOutflows

    return (
        <div className={cn(
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
                <h1 className="text-sm font-black uppercase tracking-widest leading-tight">{title}</h1>
                <div className="flex justify-center items-center gap-2 mt-1">
                    <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Informe {type}</span>
                    <span className="text-[10px] font-mono font-bold text-black/40">Sesión #{data.session_id}</span>
                </div>
                <p className="text-[10px] font-bold uppercase text-black/60 mt-2">{new Date().toLocaleString()}</p>
            </div>

            {/* SECCIÓN A: CONTROL DE EFECTIVO */}
            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 border-b border-black/10 pb-1">
                    <Calculator className="h-3 w-3 text-black" />
                    <h4 className="font-black text-[10px] uppercase tracking-widest">Control de Efectivo</h4>
                </div>

                <div className="space-y-2 text-[11px] leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Fondo Inicial:</span>
                        <span className="font-mono">{formatCurrency(data.opening_balance)}</span>
                    </div>

                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">(+) Ventas Efectivo:</span>
                        <span className="font-black font-mono">+{formatCurrency(data.total_cash_sales)}</span>
                    </div>

                    {totalInflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold uppercase text-black/60">(+) Otros Depósitos:</span>
                            <span className="font-black font-mono">+{formatCurrency(totalInflows)}</span>
                        </div>
                    )}

                    {totalOutflows > 0 && (
                        <div className="flex justify-between">
                            <span className="font-bold uppercase text-black/60">(-) Retiros / Gastos:</span>
                            <span className="font-black font-mono text-red-600">-{formatCurrency(totalOutflows)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t-2 border-black mt-2">
                        <span className="font-black text-xs uppercase tracking-tight">Efectivo Esperado:</span>
                        <span className="font-black text-xl font-mono tracking-tighter">{formatCurrency(calculatedExpected)}</span>
                    </div>
                </div>

                {/* Detalle de Movimientos Manuales */}
                {data.manual_movements && data.manual_movements.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dashed border-black/10 space-y-2">
                         <p className="font-black text-[9px] uppercase tracking-widest text-black/40 mb-2">Detalle Movimientos</p>
                        {data.manual_movements.map((move) => {
                            const isInflow = move.movement_type === 'DEPOSIT' ||
                                (data.treasury_account_id && move.to_account === data.treasury_account_id) ||
                                (move.movement_type === 'TRANSFER' && move.justify_reason !== 'TRANSFER_OUT' && !move.from_account);

                            const amount = Number(move.amount);
                            const label = move.justify_reason ? move.justify_reason.replace(/_/g, ' ') : move.movement_type_display;

                            return (
                                <div key={move.id} className="flex justify-between items-start text-[10px] leading-tight">
                                    <div className="flex flex-col pr-4">
                                        <span className="font-bold uppercase">{label}</span>
                                        {move.notes && <span className="text-[8px] italic text-black/50">{move.notes}</span>}
                                    </div>
                                    <span className={cn("font-black font-mono", isInflow ? "text-black" : "text-red-600")}>
                                        {isInflow ? "+" : "-"}{formatCurrency(amount)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* SECCIÓN B: RESUMEN DE VENTAS */}
            <div className="space-y-4 pt-4 border-t-2 border-black">
                <div className="flex items-center gap-2 border-b border-black/10 pb-1">
                    <TrendingUp className="h-3 w-3 text-black" />
                    <h4 className="font-black text-[10px] uppercase tracking-widest">Resumen de Ventas</h4>
                </div>

                <div className="space-y-1.5 text-[11px] leading-tight">
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Efectivo:</span>
                        <span className="font-mono">{formatCurrency(data.total_cash_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Tarjeta:</span>
                        <span className="font-mono">{formatCurrency(data.total_card_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Transferencia:</span>
                        <span className="font-mono">{formatCurrency(data.total_transfer_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold uppercase text-black/60">Crédito:</span>
                        <span className="font-mono">{formatCurrency(data.total_credit_sales)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t-2 border-black mt-2">
                        <span className="font-black text-xs uppercase tracking-tight">Total Ventas:</span>
                        <span className="font-black text-xl font-mono tracking-tighter">{formatCurrency(data.total_sales)}</span>
                    </div>
                </div>
            </div>

            {/* Ventas por Categoría */}
            {data.sales_by_category && data.sales_by_category.length > 0 && (
                <div className="mt-6 pt-4 border-t border-dashed border-black/20 space-y-2">
                    <p className="font-black text-[9px] uppercase tracking-widest text-black/40 mb-2">Ventas por Categoría</p>
                    {data.sales_by_category.map((cat, idx) => (
                        <div key={idx} className="flex justify-between text-[10px] font-bold">
                            <span className="uppercase">{cat.name}</span>
                            <span className="font-mono">{formatCurrency(cat.value)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 text-center space-y-2 border-t border-black/10 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">Control de Caja ERPGrafico</p>
                <p className="text-[8px] font-mono text-black/20 italic">Fin de Turno - {data.user_name || 'Sistema'}</p>
            </div>

            {/* Print button inside preview */}
            <div className="mt-6 pt-6 border-t border-dashed border-black/20 flex justify-center print:hidden">
                <Button 
                    onClick={() => window.print()} 
                    className="bg-black text-white hover:bg-black/90 font-black uppercase tracking-widest text-[10px] h-10 px-8 rounded-xl shadow-lg border-2 border-black"
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Informe
                </Button>
            </div>
        </div>
    )
}
