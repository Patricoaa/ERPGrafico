"use client"

import type { ReactNode } from 'react'
import { ExternalLink, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge, QuantityDisplay, StepHeader } from '@/components/shared'
import { PlanningEmptyState } from '../shared/PlanningEmptyState'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import type { WorkOrder, WorkOrderMaterial } from '../../types'

interface OutsourcingVerificationStepProps {
  order: WorkOrder
  headerActions?: ReactNode
}

export function OutsourcingVerificationStep({
  order, headerActions,
}: OutsourcingVerificationStepProps) {
  const { openEntity } = useGlobalModals()
  const outsourced = order.materials?.filter((m: WorkOrderMaterial) => m.is_outsourced) ?? []

  return (
    <div className="flex flex-1 flex-col gap-3">
      <StepHeader
        title="Verificación de Tercerizados"
        description="Confirma la recepción de los servicios externos contratados."
        icon={Truck}
        rightContent={headerActions}
      />
      {outsourced.length === 0 && <PlanningEmptyState kind="outsourcing" />}
      <div className="grid gap-3">
        {outsourced.map((m: WorkOrderMaterial) => {
          const receiving = m.purchase_order_receiving_status === 'RECEIVED' || m.purchase_order_receiving_status === 'PARTIAL'
            ? m.purchase_order_receiving_status
            : 'PENDING'

          return (
            <div key={m.id} className="flex items-center justify-between gap-4 p-3 border rounded-md bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium truncate">{m.component_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.supplier_name} · <QuantityDisplay value={m.quantity_planned} uom={m.uom_name} decimals={2} className="font-sans" />
                    {m.purchase_order_number && <> · OC {m.purchase_order_number}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={receiving} size="sm" />
                {m.purchase_order_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => m.purchase_order_id && openEntity('purchasing.purchaseorder', m.purchase_order_id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver OC
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
