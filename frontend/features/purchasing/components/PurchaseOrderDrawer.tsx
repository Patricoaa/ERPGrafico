'use client'

import React from 'react'
import { Drawer, StatusBadge, SkeletonShell, FormSplitLayout } from '@/components/shared'
import { useDrawerIdentity, usePrintableDrawer } from "@/features/_shared/drawer"
import { formatCurrency } from '@/lib/money'
import { PrintableLayout } from '@/features/_shared'
import { usePurchaseOrderDetail } from '@/features/purchasing/hooks/usePurchaseOrderDetail'
import { ActivitySidebar } from '@/features/audit'
import type { TransactionDrawerProps } from '@/features/_shared'
import { formDrawerWidth } from '@/lib/form-widths'

interface PurchaseOrderDrawerProps extends TransactionDrawerProps {
  purchaseOrderId?: number
}

export function PurchaseOrderDrawer({ id, open, onOpenChange, purchaseOrderId }: PurchaseOrderDrawerProps) {
  const entityId = id ?? purchaseOrderId ?? null
  const { data: order, isLoading } = usePurchaseOrderDetail(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()

  const displayId = String(order?.display_id ?? order?.number ?? `#${entityId}`)
  const supplier = order?.supplier
  const contactName = supplier && typeof supplier === 'object'
    ? String((supplier as unknown as Record<string, unknown>).name ?? '')
    : ''

  const orderLines = (order?.lines as Array<Record<string, unknown>> | undefined)

  const identity = useDrawerIdentity('purchasing.purchaseorder', 'view', order, {
    customTitle: displayId,
    subtitle: contactName,
    onPrint: handlePrint,
  })

  return (
    <>
      <PrintableLayout
        ref={printRef}
        title="Orden de Compra"
        displayId={displayId}
        subtitle={contactName}
      >
        {orderLines?.map((line: Record<string, unknown>, idx: number) => (
          <div key={Number(line.id) || idx} className="flex justify-between text-[10px]">
            <span className="flex-1">{String(line.product_name)}</span>
            <span className="w-12 text-right">{Math.round(Number(line.quantity))}</span>
            <span className="w-16 text-right">{formatCurrency(Number(line.unit_cost))}</span>
          </div>
        ))}
        {Number(order?.total) > 0 && (
          <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
            <span>Total</span>
            <span>{formatCurrency(Number(order?.total))}</span>
          </div>
        )}
      </PrintableLayout>

      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        side="left"
        defaultSize={formDrawerWidth("master", !!entityId)}
        icon={identity.icon}
        title={identity.title}
        headerActions={identity.headerActions}
        subtitle={identity.subtitle}
      >
        <FormSplitLayout sidebar={entityId ? <ActivitySidebar entityType="purchase_order" entityId={entityId} /> : undefined} showSidebar={!!entityId}>
          <SkeletonShell isLoading={isLoading} ariaLabel="Cargando orden de compra">
          {order && (
            <div className="p-4 space-y-4">
              <StatusBadge status={String(order.status)} />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Total</span>
                  <p className="font-bold text-lg">{formatCurrency(Number(order.total))}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Proveedor</span>
                  <p className="font-medium">{contactName || `#${String(order.supplier)}`}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Notas</span>
                  <p className="text-sm">{String(order.notes ?? '-')}</p>
                </div>
              </div>

              {orderLines && orderLines.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold mb-2">Líneas</h4>
                  <div className="space-y-2">
                    {orderLines.map((line: Record<string, unknown>, idx: number) => (
                      <div key={Number(line.id) || idx} className="flex justify-between text-sm border-b pb-1">
                        <div>
                          <span className="font-medium">{String(line.product_name)}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {String(line.uom_name)}
                          </span>
                        </div>
                        <span className="font-mono">
                          {Math.round(Number(line.quantity))} × {formatCurrency(Number(line.unit_cost))}
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
