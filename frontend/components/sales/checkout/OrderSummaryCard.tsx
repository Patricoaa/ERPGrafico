"use client"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { User, ShoppingBag, Tag, CreditCard } from "lucide-react"

interface OrderSummaryCardProps {
    orderLines: any[]
    total: number
    customerName?: string
    dteType?: string
    paymentData?: {
        method: string
        amount: number
        creditAssigned?: number
    }
    deliveryData?: {
        type: string
        date?: string
    }
    currentStep: number
}

const methodLabels: Record<string, string> = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia',
    'CREDIT': 'Crédito'
}

const deliveryLabels: Record<string, string> = {
    'IMMEDIATE': 'Entrega Inmediata',
    'SCHEDULED': 'Entrega Programada',
    'PICKUP': 'Retiro en Tienda'
}

export function OrderSummaryCard({
    orderLines,
    total,
    customerName,
    dteType,
    paymentData,
    deliveryData,
    currentStep
}: OrderSummaryCardProps) {
    return (
        <div className="h-full flex flex-col bg-muted/20 border-l">
            <div className="flex-1 overflow-auto custom-scrollbar">
                {/* Progressive Summary Section */}
                <div className="p-4 space-y-3 bg-background/50 border-b">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 mb-4 px-2">
                        Resumen de Proceso
                    </h3>

                    {/* Step 1: Customer */}
                    {customerName && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 animate-in slide-in-from-right-2 duration-300">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase text-primary/60 leading-none mb-1">Cliente</p>
                                <p className="text-sm font-bold truncate">{customerName}</p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: DTE */}
                    {dteType && currentStep > 1 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100 animate-in slide-in-from-right-2 duration-300">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <Tag className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase text-blue-600/60 leading-none mb-1">Documento</p>
                                <p className="text-sm font-bold truncate">{dteType}</p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment */}
                    {paymentData && currentStep > 2 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 animate-in slide-in-from-right-2 duration-300">
                            <div className="p-2 rounded-lg bg-emerald-100">
                                <CreditCard className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase text-emerald-600/60 leading-none mb-1">Pago</p>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-bold">{methodLabels[paymentData.method]}</p>
                                    <p className="text-sm font-black text-emerald-700">${paymentData.amount.toLocaleString()}</p>
                                </div>
                                {paymentData.creditAssigned !== undefined && paymentData.creditAssigned > 0 && (
                                    <div className="mt-1 pt-1 border-t border-emerald-200 flex justify-between text-[10px]">
                                        <span className="font-bold text-orange-600">Crédito:</span>
                                        <span className="font-black text-orange-700">${paymentData.creditAssigned.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Delivery */}
                    {deliveryData && currentStep > 3 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100 animate-in slide-in-from-right-2 duration-300">
                            <div className="p-2 rounded-lg bg-purple-100">
                                <ShoppingBag className="h-4 w-4 text-purple-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase text-purple-600/60 leading-none mb-1">Despacho</p>
                                <p className="text-sm font-bold truncate">{deliveryLabels[deliveryData.type]}</p>
                            </div>
                        </div>
                    )}

                    {!customerName && (
                        <div className=" py-8 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed opacity-40">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                                <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground italic">Inicie el proceso seleccionando un cliente</p>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4" />
                            Detalle de Productos
                        </h3>

                        <div className="space-y-4">
                            {orderLines.map((line, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-4 animate-in fade-in duration-500">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2" title={line.product_name || line.name || line.description}>
                                            {line.product_name || line.name || line.description}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground font-bold">
                                                {line.qty || line.quantity} {line.uom_name || 'un'}
                                            </Badge>
                                            {line.product_type === 'MANUFACTURABLE' && (
                                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none text-[8px] py-0 h-4 font-black uppercase">
                                                    Fab
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                        {((line.qty || line.quantity) * (line.unit_price_net || line.unit_price)).toLocaleString('es-CL')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] space-y-3">
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>Subtotal Neto</span>
                    <span className="whitespace-nowrap font-mono">{(total / 1.19).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>IVA (19%)</span>
                    <span className="whitespace-nowrap font-mono">{(total - (total / 1.19)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                </div>
                <Separator className="my-2 opacity-50" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Venta</span>
                    <span className="text-2xl font-black text-primary tracking-tighter whitespace-nowrap">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </span>
                </div>
            </div>
        </div>
    )
}
