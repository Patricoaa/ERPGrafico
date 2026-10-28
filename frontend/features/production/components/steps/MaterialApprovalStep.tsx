"use client"

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Package } from 'lucide-react'
import { StatusBadge, QuantityDisplay, StepHeader } from '@/components/shared'
import { StepEmptyPanel } from '../shared/StepEmptyPanel'
import type { WorkOrder, WorkOrderMaterial } from '../../types'

interface MaterialApprovalStepProps {
  order: WorkOrder
  headerActions?: ReactNode
}

export function MaterialApprovalStep({
  order, headerActions,
}: MaterialApprovalStepProps) {
  const stockMaterials = order.materials?.filter((m: WorkOrderMaterial) => !m.is_outsourced) ?? []

  return (
    <div className="flex flex-1 flex-col gap-3">
      <StepHeader
        title="Aprobación de Stock"
        description="Verifica que los materiales asignados estén disponibles en bodega."
        icon={CheckCircle2}
        rightContent={headerActions}
      />
      {stockMaterials.length === 0 && (
        <StepEmptyPanel
          icon={Package}
          title="Sin materiales de stock"
          description="Esta OT no consume materiales de stock: no hay nada que aprobar."
        />
      )}
      <div className="grid gap-3">
          {stockMaterials.map((m: WorkOrderMaterial) => (
            <div key={m.id} className="flex items-center justify-between gap-4 p-3 border rounded-md bg-card">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">{m.component_name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.component_code} · Requerido: <QuantityDisplay value={m.quantity_planned} uom={m.uom_name} decimals={2} className="font-sans" />
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">En bodega</p>
                  <p className={cn(
                    'text-sm font-medium tabular-nums',
                    (m.stock_available ?? 0) >= m.quantity_planned ? 'text-success' : 'text-destructive',
                  )}>
                    {(m.stock_available ?? 0) >= 999999 ? '∞' : (m.stock_available ?? 0)} {m.uom_name}
                  </p>
                </div>
                <StatusBadge
                  status={m.is_available ? 'active' : 'inactive'}
                  label={m.is_available ? 'Disponible' : 'Sin Stock'}
                  size="sm"
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
