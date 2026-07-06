'use client'

import React from 'react'
import { Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { useDrawerIdentity, usePrintableDrawer } from '@/features/_shared/drawer'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared'
import { useSaleOrder } from '@/features/sales/hooks/useSalesOrders'
import type { TransactionDrawerProps } from '@/features/_shared'
import { formDrawerWidth } from '@/lib/form-widths'

interface SaleDeliveryDrawerProps extends TransactionDrawerProps {
    deliveryId?: number
    /** The sale order that this delivery belongs to */
    saleOrderId?: number
}

export function SaleDeliveryDrawer({ id, open, onOpenChange, saleOrderId, deliveryId }: SaleDeliveryDrawerProps) {
    const entityId = saleOrderId ?? null
    const { data: order, isLoading } = useSaleOrder(entityId)
    const { printRef, handlePrint } = usePrintableDrawer()

    const delivery = order?.related_documents?.deliveries?.find(d => d.id === (id ?? deliveryId))
    const deliveryNumber = delivery?.number ?? `#${id ?? deliveryId}`
    const partnerName = order?.customer_name ?? ''

    const identity = useDrawerIdentity('sales.saledelivery', 'view', delivery, {
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
                        <span>{order?.number ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Fecha:</span>
                        <span>{formatPlainDate(delivery?.date)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Estado:</span>
                        <span>{delivery?.status ?? '-'}</span>
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
                        <StatusBadge status={delivery?.status ?? ''} />
                        <div className="text-sm text-muted-foreground">
                            <p>Orden asociada: {order?.number ?? '-'}</p>
                            <p>Cliente: {partnerName}</p>
                        </div>
                        {delivery?.date && (
                            <p className="text-sm">
                                <span className="text-muted-foreground">Fecha: </span>
                                {formatPlainDate(delivery.date)}
                            </p>
                        )}
                    </div>
                </SkeletonShell>
            </Drawer>
        </>
    )
}
