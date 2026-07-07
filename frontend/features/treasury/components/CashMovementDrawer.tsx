'use client'

import React from 'react'
import { Drawer, SkeletonShell, FormSplitLayout } from '@/components/shared'
import { useDrawerIdentity, usePrintableDrawer } from "@/features/_shared"
import { formatCurrency } from '@/lib/money'
import { PrintableLayout } from '@/features/_shared'
import { useTreasuryMovement } from '@/features/treasury/hooks/useTreasuryMovement'
import { ActivitySidebar } from '@/features/audit'
import type { TransactionDrawerProps } from '@/features/_shared'
import { formDrawerWidth } from '@/lib/form-widths'

interface CashMovementDrawerProps extends TransactionDrawerProps {
  movementId?: number
}

export function CashMovementDrawer({ id, open, onOpenChange, movementId }: CashMovementDrawerProps) {
  const entityId = id ?? movementId ?? null
  const { data: movement, isLoading } = useTreasuryMovement(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()

  const displayId = movement?.display_id ?? `#${entityId}`
  const movementType = movement?.movement_type_display ?? movement?.movement_type ?? ''
  const identity = useDrawerIdentity('treasury.treasurymovement', 'view', movement, {
    onPrint: handlePrint,
  })

  return (
    <>
      <PrintableLayout
        ref={printRef}
        title="Movimiento de Tesorería"
        displayId={displayId}
        subtitle={movementType}
      >
        <div className="text-[9px] space-y-1 mb-2">
          <div className="flex justify-between">
            <span>Origen:</span>
            <span>{movement?.from_container_name ?? movement?.from_account_name ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>Destino:</span>
            <span>{movement?.to_container_name ?? movement?.to_account_name ?? '-'}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t mt-1">
            <span>Monto:</span>
            <span>{formatCurrency(Number(movement?.amount ?? 0))}</span>
          </div>
        </div>
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
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando movimiento" className="flex-1 flex flex-col">
          {movement && (
            <FormSplitLayout
              sidebar={entityId ? <ActivitySidebar entityType="payment" entityId={entityId} /> : undefined}
              showSidebar={!!entityId}
            >
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Monto</span>
                    <p className={`font-bold text-lg ${movement.movement_type === 'OUTBOUND' ? 'text-expense' : 'text-income'}`}>
                      {movement.movement_type === 'OUTBOUND' ? '-' : '+'}
                      {formatCurrency(Number(movement.amount))}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Método de Pago</span>
                    <p className="font-medium">{movement.payment_method_display ?? movement.payment_method ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Origen</span>
                    <p className="font-medium">{movement.from_container_name ?? movement.from_account_name ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Destino</span>
                    <p className="font-medium">{movement.to_container_name ?? movement.to_account_name ?? '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Notas</span>
                    <p className="text-sm">{movement.notes || movement.justify_reason || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Creado por</span>
                    <p className="text-sm">{movement.created_by_name ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Referencia</span>
                    <p className="text-sm">{movement.reference ?? '-'}</p>
                  </div>
                </div>
              </div>
            </FormSplitLayout>
          )}
        </SkeletonShell>
      </Drawer>
    </>
  )
}
