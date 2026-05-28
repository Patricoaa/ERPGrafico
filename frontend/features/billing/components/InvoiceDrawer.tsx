'use client'

import React, { useRef } from 'react'
import { Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer, X, Receipt } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared/transaction-drawer'
import { useInvoice } from '@/features/billing/hooks/useInvoices'
import type { TransactionDrawerProps } from '@/features/_shared/transaction-drawer'

interface InvoiceDrawerProps extends TransactionDrawerProps {
    invoiceId?: number
}

export function InvoiceDrawer({ id, open, onOpenChange, mode = 'view', invoiceId }: InvoiceDrawerProps) {
    const entityId = id ?? invoiceId ?? null
    const { data: invoice, isLoading } = useInvoice(entityId)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const displayId = invoice?.display_id ?? invoice?.number ?? `#${entityId}`
    const dteLabel = invoice?.dte_type_display ?? invoice?.dte_type ?? ''
    const partnerName = invoice?.partner_name ?? invoice?.customer_name ?? invoice?.supplier_name ?? ''

    return (
        <>
            <PrintableLayout
                ref={printRef}
                title={dteLabel || 'Comprobante'}
                displayId={displayId}
                subtitle={partnerName}
            >
                <div className="text-[9px] space-y-1 mb-2">
                    <div className="flex justify-between">
                        <span>Folio:</span>
                        <span>{(invoice as any)?.folio_number ?? (invoice as any)?.folio ?? 'S/N'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Vencimiento:</span>
                        <span>{formatPlainDate((invoice as any)?.due_date)}</span>
                    </div>
                </div>
                {invoice?.lines?.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                        <span className="flex-1">{'product_name' in line ? (line as any).product_name : line.description ?? '-'}</span>
                        <span className="w-12 text-right">{Math.round(Number((line as any).quantity ?? 0))}</span>
                        <span className="w-16 text-right">{formatCurrency(Number((line as any).unit_price ?? 0))}</span>
                    </div>
                ))}
                {invoice?.total && (
                    <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
                        <span>Total</span>
                        <span>{formatCurrency(Number(invoice.total))}</span>
                    </div>
                )}
            </PrintableLayout>

            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize="50%"
                icon={Receipt}
                title={displayId}
                subtitle={partnerName}
                description={`${dteLabel} · ${formatPlainDate(invoice?.date)}`}
                headerActions={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint()}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                }
            >
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando factura">
                    {invoice && (
                        <div className="p-4 space-y-4">
                            <StatusBadge status={invoice.status} />

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-xs text-muted-foreground">Total</span>
                                    <p className="font-bold text-lg">{formatCurrency(Number(invoice.total))}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Tipo DTE</span>
                                    <p className="font-medium">{dteLabel}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Pendiente</span>
                                    <p className="font-bold">{formatCurrency(Number(invoice.pending_amount ?? 0))}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </SkeletonShell>
            </Drawer>
        </>
    )
}
