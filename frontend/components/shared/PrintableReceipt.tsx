"use client"

import React, { forwardRef } from "react"
import { formatCurrency } from "@/lib/money"
import type { TransactionData, TransactionLine } from "@/types/transactions"
import { useBranding } from "@/contexts/BrandingProvider"
import { formatPlainDate } from "@/lib/utils"

interface PrintableReceiptProps {
    data: TransactionData & { terminal_name?: string }
    currentType: "sale_order" | "invoice"
    mainTitle: string
    subTitle: string
}

export const PrintableReceipt = forwardRef<HTMLDivElement, PrintableReceiptProps>(
    function PrintableReceipt({ data, mainTitle, subTitle }, ref) {
        const { logo } = useBranding()

        const lines = (data?.lines ?? data?.items ?? []) as TransactionLine[]
        const customerName = data?.customer?.name ?? data?.customer?.full_name ?? data?.partner?.name ?? data?.partner?.full_name ?? data?.partner_name ?? data?.customer_name ?? subTitle
        const displayId = data?.display_id ?? data?.number?.toString() ?? data?.transaction_number ?? "—"
        const date = data?.created_at ?? data?.date ?? data?.document_date ?? ""
        const formattedDate = date
            ? (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
                ? formatPlainDate(date)
                // eslint-disable-next-line no-restricted-syntax -- date/time formatting, not currency or quantity
                : new Date(date).toLocaleString("es-CL"))
            : ""
        const terminalName = data?.terminal_name ?? data?.pos_session?.terminal_name ?? data?.session?.terminal_name ?? ""

        const totalNet = Number(data?.total_net ?? 0)
        const totalTax = Number(data?.total_tax ?? 0)
        const totalDiscount = Number(data?.total_discount_amount ?? 0)
        const total = Number(data?.total ?? data?.amount ?? 0)

        return (
            <div ref={ref} className="hidden print:block print:p-4 font-mono text-xs leading-tight">
                <style>{`
                    @page { size: 80mm auto; margin: 4mm; }
                    @media print { body { -webkit-print-color-adjust: exact; } }
                `}</style>

                {/* Header */}
                <div className="text-center border-b border-dashed pb-3 mb-3">
                    {logo && (
                        // eslint-disable-next-line @next/next/no-img-element -- print context, next/image doesn't support print CSS
                        <img
                            src={logo}
                            alt="Logo"
                            className="h-10 mx-auto mb-1 object-contain"
                            style={{ maxWidth: "60mm" }}
                        />
                    )}
                    <p className="font-bold text-sm">{mainTitle}</p>
                    <p className="text-[10px] text-muted-foreground">{displayId}</p>
                    {formattedDate && (
                        <p className="text-[9px] text-muted-foreground/80">{formattedDate}</p>
                    )}
                    {terminalName && (
                        <p className="text-[9px] text-muted-foreground/80">Terminal: {terminalName}</p>
                    )}
                    <p className="text-[10px] mt-1">{customerName}</p>
                </div>

                {/* Line Items Header */}
                <div className="flex font-bold border-b border-dashed pb-1 mb-1 text-[9px]">
                    <span className="flex-1">Producto</span>
                    <span className="w-10 text-right">Cant</span>
                    <span className="w-16 text-right">Precio</span>
                    <span className="w-16 text-right">Total</span>
                </div>

                {/* Line Items */}
                {lines.map((line, idx) => {
                    const name = line?.product_name ?? line?.product?.name ?? line?.description ?? ""
                    const code = line?.product_code ?? line?.product?.sku ?? line?.product?.default_code ?? ""
                    const qty = Number(line?.quantity ?? line?.delivered_quantity ?? line?.qty_delivered ?? 0)
                    const price = Number(line?.unit_price ?? line?.unit_price_gross ?? 0)
                    const subtotal = Number(line?.subtotal ?? line?.amount ?? 0)
                    const discount = Number(line?.discount_amount ?? 0)

                    return (
                        <div key={idx} className="flex mb-1 text-[9px]">
                            <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{name || code || "—"}</p>
                                {discount > 0 && (
                                    <p className="text-[8px] text-muted-foreground/80">Desc: {formatCurrency(discount)}</p>
                                )}
                            </div>
                            <span className="w-10 text-right">{qty}</span>
                            <span className="w-16 text-right">{formatCurrency(price)}</span>
                            <span className="w-16 text-right font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                    )
                })}

                {/* Totals */}
                <div className="border-t border-dashed pt-2 mt-2 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                        <span>Neto</span>
                        <span>{formatCurrency(totalNet)}</span>
                    </div>
                    {totalDiscount > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Dto. total</span>
                            <span>-{formatCurrency(totalDiscount)}</span>
                        </div>
                    )}
                    {totalTax > 0 && (
                        <div className="flex justify-between">
                            <span>IVA</span>
                            <span>{formatCurrency(totalTax)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center border-t border-dashed pt-2 mt-3 text-[9px] text-muted-foreground/80">
                    <p>Gracias por su preferencia</p>
                    <p>Generado por ERPGrafico</p>
                </div>

                {/* Paper cut indicator */}
                <div className="text-center text-[6px] text-muted-foreground/60 mt-2">
                    {"- ".repeat(16)}
                </div>
            </div>
        )
    },
)
