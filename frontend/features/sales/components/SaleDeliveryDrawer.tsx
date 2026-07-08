'use client'

import React from 'react'
import { Chip, Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { useDrawerIdentity, usePrintableDrawer } from '@/features/_shared/drawer'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared'
import { useSaleOrder } from '@/features/sales/hooks/useSalesOrders'
import { useSaleDelivery } from '@/features/sales/hooks/useSaleDeliveries'
import type { TransactionDrawerProps } from '@/features/_shared'
import { formDrawerWidth } from '@/lib/form-widths'

interface SaleDeliveryDrawerProps extends TransactionDrawerProps {
    deliveryId?: number
    saleOrderId?: number
}

export function SaleDeliveryDrawer({ id, open, onOpenChange, saleOrderId, deliveryId }: SaleDeliveryDrawerProps) {
    const entityId = saleOrderId ?? null
    const entityOpen = open && !!entityId ? entityId : null
    const { saleOrder: order, isLoading: orderLoading } = useSaleOrder(entityOpen)
    const { printRef, handlePrint } = usePrintableDrawer()

    const deliveryId_ = id ?? deliveryId

    const { data: directDelivery, isLoading: directLoading } = useSaleDelivery(
        open && !entityId ? (deliveryId_ ?? null) : null
    )

    const rawDelivery: Record<string, unknown> | undefined = entityId
        ? order?.related_documents?.deliveries?.find((d: Record<string, unknown>) => d.id === deliveryId_)
        : (directDelivery as Record<string, unknown> | undefined)

    const isLoading = entityId ? orderLoading : directLoading

    const d = (key: string): string | undefined => rawDelivery?.[key] as string | undefined

    const deliveryNumber = d('number') ?? `#${deliveryId_}`
    const partnerName = d('customer_name') ?? order?.customer_name ?? ''
    const relatedNoteDisplay = d('related_note_display')
    const deliveryType = d('delivery_type')
    const date = d('delivery_date') ?? d('date')
    const status = d('status') ?? ''
    const saleOrderNumber = d('sale_order_number') ?? order?.number ?? '-'
    const warehouseName = d('warehouse_name') ?? '-'

    const identity = useDrawerIdentity('sales.saledelivery', 'view', rawDelivery, {
        overrideTitle: deliveryNumber,
        onPrint: handlePrint,
    })

    return (
        <>
            <PrintableLayout
                ref={printRef}
                title="Guía de Despacho"
                displayId={deliveryNumber}
                subtitle={partnerName}
            >
                <div className="text-[9px] space-y-1 mb-2">
                    <div className="flex justify-between">
                        <span>Orden:</span>
                        <span>{saleOrderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Fecha:</span>
                        <span>{date ? formatPlainDate(date) : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Estado:</span>
                        <span>{status}</span>
                    </div>
                </div>
            </PrintableLayout>

            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("master", false)}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
            >
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando despacho">
                    <div className="p-4 space-y-4">
                        {deliveryType === 'debit_note' && (
                            <div className="flex items-center gap-2">
                                <Chip intent="warning" size="sm">Nota Débito</Chip>
                                {relatedNoteDisplay && (
                                    <span className="text-sm text-muted-foreground">ND: {relatedNoteDisplay}</span>
                                )}
                            </div>
                        )}
                        <StatusBadge status={status} />
                        <div className="text-sm text-muted-foreground">
                            <p>Orden asociada: {saleOrderNumber}</p>
                            <p>Cliente: {partnerName}</p>
                            <p>Bodega: {warehouseName}</p>
                        </div>
                        {date && (
                            <p className="text-sm">
                                <span className="text-muted-foreground">Fecha: </span>
                                {formatPlainDate(date)}
                            </p>
                        )}
                    </div>
                </SkeletonShell>
            </Drawer>
        </>
    )
}
