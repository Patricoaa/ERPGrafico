"use client"

import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import { Printer, Calculator, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

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
}

export function POSReport({ data, title = "Informe de Caja", type = "X" }: POSReportProps) {
    const handlePrint = () => {
        window.print()
    }

    // Calcular totales para validación visual
    const totalInflows = data.total_manual_inflow || 0
    const totalOutflows = data.total_manual_outflow || 0
    const calculatedExpected = data.opening_balance + data.total_cash_sales + totalInflows - totalOutflows

    return (
        <div className="w-full max-w-sm mx-auto bg-white p-4 shadow-sm border text-sm print:shadow-none print:border-none rounded-lg">
            {/* Header */}
            <div className="text-center mb-6">
                <h3 className="font-bold text-xl uppercase tracking-tight">{title}</h3>
                <div className="flex justify-center items-center gap-2 text-muted-foreground mt-1">
                    <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium">Informe {type}</span>
                    <span className="text-xs">Sesión #{data.session_id}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date().toLocaleString()}</p>
            </div>

            {/* SECCIÓN A: CONTROL DE EFECTIVO (Priority 1) */}
            <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <h4 className="font-bold text-sm uppercase text-primary">Control de Efectivo</h4>
                </div>

                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                    {/* Fondo Inicial */}
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fondo Inicial (Apertura)</span>
                        <span className="font-medium">{formatCurrency(data.opening_balance)}</span>
                    </div>

                    {/* (+) Ventas Efectivo */}
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">(+) Ventas en Efectivo</span>
                        <span className="font-medium text-emerald-600">+{formatCurrency(data.total_cash_sales)}</span>
                    </div>

                    {/* (+) Otros Ingresos */}
                    {totalInflows > 0 && (
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">(+) Otros Depósitos</span>
                            <span className="font-medium text-emerald-600">+{formatCurrency(totalInflows)}</span>
                        </div>
                    )}

                    {/* (-) Otros Egresos */}
                    {totalOutflows > 0 && (
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">(-) Retiros / Gastos</span>
                            <span className="font-medium text-red-600">-{formatCurrency(totalOutflows)}</span>
                        </div>
                    )}

                    <Separator className="my-2 bg-muted-foreground/20" />

                    {/* = EFECTIVO ESPERADO */}
                    <div className="flex justify-between items-end">
                        <span className="font-bold text-sm uppercase">Efectivo Esperado</span>
                        <span className="font-black text-xl tracking-tight">{formatCurrency(calculatedExpected)}</span>
                    </div>
                </div>

                {/* Detalle de Movimientos Manuales (Si existen) */}
                {data.manual_movements && data.manual_movements.length > 0 && (
                    <div className="text-[10px] space-y-1 pl-2 border-l-2 border-muted">
                        <p className="font-semibold text-muted-foreground uppercase mb-1">Detalle Movimientos</p>
                        {data.manual_movements.map((move) => {
                            const isInflow = move.movement_type === 'DEPOSIT' ||
                                (data.treasury_account_id && move.to_account === data.treasury_account_id) ||
                                (move.movement_type === 'TRANSFER' && move.justify_reason !== 'TRANSFER_OUT' && !move.from_account);

                            const amount = Number(move.amount);
                            const label = move.justify_reason ? move.justify_reason.replace(/_/g, ' ') : move.movement_type_display;

                            return (
                                <div key={move.id} className="flex justify-between">
                                    <span className="capitalize text-muted-foreground truncate max-w-[150px]">
                                        {label.toLowerCase()} {move.notes && `(${move.notes})`}
                                    </span>
                                    <span className={isInflow ? "text-emerald-600" : "text-red-600"}>
                                        {isInflow ? "+" : "-"}{formatCurrency(amount)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Separator className="my-4" />

            {/* SECCIÓN B: RENDIMIENTO DE VENTAS (Priority 2) */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-bold text-sm uppercase text-muted-foreground">Resumen de Ventas</h4>
                </div>

                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span>Efectivo</span>
                        <span>{formatCurrency(data.total_cash_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Tarjeta (Transbank)</span>
                        <span>{formatCurrency(data.total_card_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Transferencia</span>
                        <span>{formatCurrency(data.total_transfer_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Crédito</span>
                        <span>{formatCurrency(data.total_credit_sales)}</span>
                    </div>

                    <div className="flex justify-between font-bold text-sm pt-2 mt-1 border-t border-dashed">
                        <span>Total Ventas</span>
                        <span>{formatCurrency(data.total_sales)}</span>
                    </div>
                </div>
            </div>

            {/* Ventas por Categoría (Opcional) */}
            {data.sales_by_category && data.sales_by_category.length > 0 && (
                <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                        <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Por Categoría</p>
                        {data.sales_by_category.map((cat, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                                <span>{cat.name}</span>
                                <span>{formatCurrency(cat.value)}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="mt-8 print:hidden">
                <Button variant="outline" className="w-full gap-2" onClick={handlePrint}>
                    <Printer className="h-4 w-4" />
                    Imprimir Comprobante
                </Button>
            </div>
        </div>
    )
}
