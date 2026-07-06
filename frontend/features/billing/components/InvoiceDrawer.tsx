'use client'

import React from 'react'
import { Drawer, StatusBadge, SkeletonShell, FormSplitLayout } from '@/components/shared'
import { useDrawerIdentity, usePrintableDrawer } from "@/features/_shared/drawer"
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared'
import { useInvoice } from '@/features/billing/hooks/useInvoices'
import { ActivitySidebar } from '@/features/audit'
import type { TransactionDrawerProps } from '@/features/_shared'
import { formDrawerWidth } from '@/lib/form-widths'

interface InvoiceDrawerProps extends TransactionDrawerProps {
    invoiceId?: number
}

export function InvoiceDrawer({ id, open, onOpenChange, mode = 'view', invoiceId }: InvoiceDrawerProps) {
    const entityId = id ?? invoiceId ?? null
    const { data: invoice, isLoading } = useInvoice(entityId)
    const { printRef, handlePrint } = usePrintableDrawer()

    const displayId = invoice?.display_id ?? invoice?.number ?? `#${entityId}`
    const dteLabel = invoice?.dte_type_display ?? invoice?.dte_type ?? ''
    const partnerName = invoice?.partner_name ?? invoice?.customer_name ?? invoice?.supplier_name ?? ''

    const identity = useDrawerIdentity('billing.invoice', 'view', invoice, {
        overrideTitle: displayId,
        overrideSubtitle: partnerName,
        onPrint: handlePrint,
    })

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
                        <span>{(invoice as unknown as Record<string, unknown>)?.folio_number as string ?? (invoice as unknown as Record<string, unknown>)?.folio as string ?? 'S/N'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Vencimiento:</span>
                        <span>{formatPlainDate((invoice as unknown as Record<string, unknown>)?.due_date as string ?? '')}</span>
                    </div>
                </div>
                {invoice?.lines?.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                        <span className="flex-1">{line.product_name ?? line.description ?? '-'}</span>
                        <span className="w-12 text-right">{Math.round(Number(line.quantity ?? 0))}</span>
                        <span className="w-16 text-right">{formatCurrency(Number((line as Record<string, unknown>).unit_price ?? 0))}</span>
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
                mode="view"
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("master", !!entityId)}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
            >
                <FormSplitLayout sidebar={entityId ? <ActivitySidebar entityType="invoice" entityId={entityId} /> : undefined} showSidebar={!!entityId}>
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

                            {invoice.lines && invoice.lines.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold mb-2">Líneas</h4>
                                    <div className="space-y-2">
                                        {invoice.lines.map((line: Record<string, unknown>, idx: number) => (
                                            <div key={(line.id as number) ?? idx} className="flex justify-between text-sm border-b pb-1">
                                                <div>
                                                    <span className="font-medium">{(line.product_name as string) || (line.description as string) || '-'}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        {(line.uom_name as string) || ''}
                                                    </span>
                                                </div>
                                                <span className="font-mono">
                                                    {Math.round(Number((line.quantity as number) ?? 0))} × {formatCurrency(Number((line.unit_price as number) ?? 0))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </SkeletonShell>
                </FormSplitLayout>
            </Drawer>
        </>
    )
}
