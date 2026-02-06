"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/currency"
import { Printer } from "lucide-react"
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

    return (
        <div className="w-full max-w-sm mx-auto bg-white p-4 shadow-sm border text-sm print:shadow-none print:border-none">
            <div className="text-center mb-4">
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="text-muted-foreground">Tipo: Informe {type}</p>
                <p className="text-xs text-muted-foreground">Sesión #{data.session_id}</p>
                <p className="text-xs text-muted-foreground">{new Date().toLocaleString()}</p>
            </div>

            <Separator className="my-2" />

            <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                    <span>Ventas Totales</span>
                    <span>{formatCurrency(data.total_sales)}</span>
                </div>
            </div>

            <Separator className="my-2" />

            {data.manual_movements && data.manual_movements.length > 0 && (
                <>
                    <div className="space-y-1 mb-2">
                        <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Movimientos de Caja</p>
                        {data.manual_movements.map((move) => {
                            const isInflow = move.movement_type === 'DEPOSIT' ||
                                (data.treasury_account_id && move.to_account === data.treasury_account_id) ||
                                (move.movement_type === 'TRANSFER' && move.justify_reason !== 'TRANSFER_OUT' && !move.from_account);

                            // Movement serializer has from_account and to_account too.

                            const amount = Number(move.amount);
                            const label = move.justify_reason ? move.justify_reason.replace(/_/g, ' ') : move.movement_type_display;

                            return (
                                <div key={move.id} className="flex justify-between text-xs">
                                    <div className="flex flex-col">
                                        <span className="capitalize">{label.toLowerCase()}</span>
                                        {move.notes && <span className="text-[10px] text-muted-foreground line-clamp-1">{move.notes}</span>}
                                    </div>
                                    <span className={isInflow ? "text-green-600" : "text-red-600"}>
                                        {isInflow ? "+" : "-"}{formatCurrency(amount)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="space-y-1 text-xs border-t pt-1 border-dashed">
                        {data.total_manual_inflow !== undefined && data.total_manual_inflow > 0 && (
                            <div className="flex justify-between">
                                <span>Total Otros Ingresos</span>
                                <span className="text-green-600">+{formatCurrency(data.total_manual_inflow)}</span>
                            </div>
                        )}
                        {data.total_manual_outflow !== undefined && data.total_manual_outflow > 0 && (
                            <div className="flex justify-between">
                                <span>Total Otros Egresos</span>
                                <span className="text-red-600">-{formatCurrency(data.total_manual_outflow)}</span>
                            </div>
                        )}
                    </div>
                    <Separator className="my-2" />
                </>
            )}

            <div className="space-y-1">
                <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Desglose por Medios de Pago</p>
                <div className="flex justify-between">
                    <span>Efectivo</span>
                    <span>{formatCurrency(data.total_cash_sales)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Tarjeta</span>
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
            </div>

            <Separator className="my-2" />

            <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                    <span>Fondo Inicial</span>
                    <span>{formatCurrency(data.opening_balance)}</span>
                </div>
                <div className="flex justify-between font-bold text-base">
                    <span>Total Efectivo en Caja</span>
                    <span>{formatCurrency(data.expected_cash)}</span>
                </div>
            </div>

            {data.sales_by_category && data.sales_by_category.length > 0 && (
                <>
                    <Separator className="my-2" />
                    <div className="space-y-1">
                        <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Ventas por Categoría</p>
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
