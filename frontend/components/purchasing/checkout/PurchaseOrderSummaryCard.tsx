"use client"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Building2, ShoppingBag, Tag, CreditCard, Warehouse, Package } from "lucide-react"

interface PurchaseOrderSummaryCardProps {
    orderLines: any[]
    total: number
    supplierName?: string
    warehouseName?: string
    dteType?: string
    paymentData?: {
        method: string
        amount: number
        pendingDebt?: number
    }
    receiptData?: {
        type: string
    }
    currentStep: number
}

const methodLabels: Record<string, string> = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia'
}

const receiptLabels: Record<string, string> = {
    'IMMEDIATE': 'Recepción Inmediata',
    'DEFERRED': 'Recepción Diferida',
    'PARTIAL': 'Recepción Parcial'
}

export function PurchaseOrderSummaryCard({
    orderLines,
    total,
    supplierName,
    warehouseName,
    dteType,
    paymentData,
    receiptData,
    currentStep
}: PurchaseOrderSummaryCardProps) {
    return (
        <div className="h-full flex flex-col bg-muted/20 border-l">
            <div className="flex-1 overflow-auto custom-scrollbar">
                {/* Progressive Summary Section */}
                <div className="p-4 space-y-3 bg-background/50 border-b">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/40 mb-4 px-2">
                        Resumen de Proceso
                    </h3>

                    {/* Step 1: Supplier & Warehouse */}
                    {supplierName && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 animate-in slide-in-from-right-2 duration-300">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase text-primary/60 leading-none mb-1">Proveedor</p>
                                    <p className="text-sm font-bold truncate">{supplierName}</p>
                                </div>
                            </div>
                            {warehouseName && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100 animate-in slide-in-from-right-2 duration-300">
                                    <div className="p-2 rounded-lg bg-indigo-100">
                                        <Warehouse className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase text-indigo-600/60 leading-none mb-1">Bodega</p>
                                        <p className="text-sm font-bold truncate">{warehouseName}</p>
                                    </div>
                                </div>
                            )}
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
                                    <p className="text-sm font-bold">{paymentData.amount > 0 ? methodLabels[paymentData.method] : 'Crédito'}</p>
                                    <p className="text-sm font-black text-emerald-700">${paymentData.amount.toLocaleString()}</p>
                                </div>
                                {paymentData.pendingDebt !== undefined && paymentData.pendingDebt > 0 && (
                                    <div className="mt-1 pt-1 border-t border-orange-200 flex justify-between text-[10px]">
                                        <span className="font-bold text-orange-600">Deuda:</span>
                                        <span className="font-black text-orange-700">${paymentData.pendingDebt.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Receipt */}
                    {receiptData && currentStep > 3 && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100 animate-in slide-in-from-right-2 duration-300">
                            <div className="p-2 rounded-lg bg-purple-100">
                                <Package className="h-4 w-4 text-purple-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase text-purple-600/60 leading-none mb-1">Recepción</p>
                                <p className="text-sm font-bold truncate">{receiptLabels[receiptData.type]}</p>
                            </div>
                        </div>
                    )}

                    {!supplierName && (
                        <div className=" py-8 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed opacity-40">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground italic">Inicie el proceso seleccionando un proveedor</p>
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
                                        <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2" title={line.name}>
                                            {line.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground font-bold">
                                                {line.qty || line.quantity} {line.uom || 'un'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                        {((line.qty || line.quantity) * (line.unit_cost || 0)).toLocaleString('es-CL')}
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
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Compra</span>
                    <span className="text-2xl font-black text-destructive tracking-tighter whitespace-nowrap">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </span>
                </div>
            </div>
        </div>
    )
}
