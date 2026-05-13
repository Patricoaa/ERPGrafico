"use client"

import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApprovalTaskList } from './ApprovalTaskList'
import type { WorkOrder, WorkOrderMaterial, WorkOrderTask } from '../../types'

interface MaterialApprovalStepProps {
  order: WorkOrder
  canComplete: (task: WorkOrderTask) => boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
}

export function MaterialApprovalStep({
  order, canComplete, taskNotes, taskFiles, onNoteChange, onFileChange,
}: MaterialApprovalStepProps) {
  const stockMaterials = order.materials?.filter((m: WorkOrderMaterial) => !m.is_outsourced) ?? []

  return (
    <div className="space-y-6">
      <ApprovalTaskList
        tasks={order.workflow_tasks ?? []}
        taskType="OT_MATERIAL_APPROVAL"
        canComplete={canComplete}
        taskNotes={taskNotes}
        taskFiles={taskFiles}
        onNoteChange={onNoteChange}
        onFileChange={onFileChange}
      />

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Verifique la disponibilidad de stock en {order.warehouse_name ?? 'la bodega seleccionada'}.
        </p>
        <div className="grid gap-4">
          {stockMaterials.map((m: WorkOrderMaterial) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-md">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {m.component_name}{' '}
                  <span className="text-xs text-muted-foreground">({m.component_code})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Requerido: {m.quantity_planned} {m.uom_name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">En Bodega</p>
                  <p className={cn(
                    'text-sm font-bold',
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
          {stockMaterials.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm italic border rounded-md border-dashed">
              Sin materiales de stock requeridos.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
