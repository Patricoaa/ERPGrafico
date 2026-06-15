'use client'

import React, { useRef } from 'react'
import { Drawer, SkeletonShell } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { getEntityIcon } from "@/lib/entity-registry"
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared/transaction-drawer'
import { useTreasuryMovement } from '@/features/treasury/hooks/useTreasuryMovement'
import type { TransactionDrawerProps } from '@/features/_shared/transaction-drawer'

interface CashMovementDrawerProps extends TransactionDrawerProps {
  movementId?: number
}

export function CashMovementDrawer({ id, open, onOpenChange, movementId }: CashMovementDrawerProps) {
  const entityId = id ?? movementId ?? null
  const { data: movement, isLoading } = useTreasuryMovement(entityId)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const displayId = movement?.display_id ?? `#${entityId}`
  const movementType = movement?.movement_type_display ?? movement?.movement_type ?? ''

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
        open={open}
        onOpenChange={onOpenChange}
        side="left"
        defaultSize="50%"
                icon={getEntityIcon('treasury.treasurymovement')}
                title={<span>{displayId}</span>}
        headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
        subtitle={movementType}
        description={formatPlainDate(movement?.date ?? movement?.created_at)}

      >
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando movimiento">
          {movement && (
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
          )}
        </SkeletonShell>
      </Drawer>
    </>
  )
}
