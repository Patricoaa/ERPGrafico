'use client'

import React, { useRef } from 'react'
import { Drawer, StatusBadge, SkeletonShell, FormSplitLayout } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer, ShoppingCart } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared/transaction-drawer'
import { usePurchaseOrderDetail } from '@/features/purchasing/hooks/usePurchaseOrderDetail'
import { ActivitySidebar } from '@/features/audit/components'
import type { TransactionDrawerProps } from '@/features/_shared/transaction-drawer'

interface PurchaseOrderDrawerProps extends TransactionDrawerProps {
  purchaseOrderId?: number
}

export function PurchaseOrderDrawer({ id, open, onOpenChange, mode = 'view', purchaseOrderId }: PurchaseOrderDrawerProps) {
  const entityId = id ?? purchaseOrderId ?? null
  const { data: order, isLoading } = usePurchaseOrderDetail(entityId)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const displayId = order?.display_id ?? order?.number ?? `#${entityId}`
  const contactName = order?.supplier && typeof order.supplier === 'object' ? order.supplier.name : ''

  return (
    <>
      <PrintableLayout
        ref={printRef}
        title="Orden de Compra"
        displayId={displayId}
        subtitle={contactName}
      >
        {order?.lines?.map((line: any, idx: number) => (
          <div key={line.id ?? idx} className="flex justify-between text-[10px]">
            <span className="flex-1">{line.product_name}</span>
            <span className="w-12 text-right">{Math.round(Number(line.quantity))}</span>
            <span className="w-16 text-right">{formatCurrency(Number(line.unit_cost))}</span>
          </div>
        ))}
        {order?.total && (
          <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
            <span>Total</span>
            <span>{formatCurrency(Number(order.total))}</span>
          </div>
        )}
      </PrintableLayout>

      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        side="left"
        defaultSize="50%"
        icon={ShoppingCart}
        title={<span>{displayId}</span>}
        headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
        subtitle={contactName}
        description={`${order?.date ? formatPlainDate(order.date) : ''} · ${order?.status_display ?? order?.status ?? ''}`}
      >
        <FormSplitLayout sidebar={entityId ? <ActivitySidebar entityType="purchase_order" entityId={entityId} /> : undefined} showSidebar={!!entityId}>
          <SkeletonShell isLoading={isLoading} ariaLabel="Cargando orden de compra">
          {order && (
            <div className="p-4 space-y-4">
              <StatusBadge status={order.status} />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Total</span>
                  <p className="font-bold text-lg">{formatCurrency(Number(order.total))}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Proveedor</span>
                  <p className="font-medium">{contactName || `#${order.supplier}`}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Notas</span>
                  <p className="text-sm">{order.notes || '-'}</p>
                </div>
              </div>

              {order.lines && order.lines.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold mb-2">Líneas</h4>
                  <div className="space-y-2">
                    {order.lines.map((line: any, idx: number) => (
                      <div key={line.id ?? idx} className="flex justify-between text-sm border-b pb-1">
                        <div>
                          <span className="font-medium">{line.product_name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {line.uom_name}
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
