"use client"

import { cn } from '@/lib/utils'
import { LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApprovalTaskList } from './ApprovalTaskList'
import { useHubPanel } from '@/components/providers/HubPanelProvider'
import type { WorkOrder, WorkOrderMaterial, WorkOrderTask } from '../../types'

interface OutsourcingVerificationStepProps {
  order: WorkOrder
  canComplete: (task: WorkOrderTask) => boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
}

export function OutsourcingVerificationStep({
  order, canComplete, taskNotes, taskFiles, onNoteChange, onFileChange,
}: OutsourcingVerificationStepProps) {
  const { openHub } = useHubPanel()
  const outsourced = order.materials?.filter((m: WorkOrderMaterial) => m.is_outsourced) ?? []

  return (
    <div className="space-y-6">
      <ApprovalTaskList
        tasks={order.workflow_tasks ?? []}
        taskType="OT_OUTSOURCING_VERIFICATION"
        canComplete={canComplete}
        taskNotes={taskNotes}
        taskFiles={taskFiles}
        onNoteChange={onNoteChange}
        onFileChange={onFileChange}
      />

      <div className="p-4 bg-warning/5 border border-warning/10 rounded-md flex gap-3">
        <LayoutDashboard className="h-5 w-5 text-warning shrink-0" />
        <div className="text-sm text-warning font-medium">
          <p className="font-bold">Verificación de Servicios Tercerizados</p>
          <p className="text-xs">
            Valide que todos los servicios externos hayan sido recibidos correctamente en el sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {outsourced.map((m: WorkOrderMaterial) => {
          const isReceived = m.purchase_order_receiving_status === 'RECEIVED'
          const statusLabel = isReceived
            ? 'Recibido'
            : m.purchase_order_receiving_status === 'PARTIAL'
            ? 'Parcial'
            : 'Pendiente'

          return (
            <div key={m.id} className="flex items-center justify-between p-4 border rounded-md bg-background">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'h-3 w-3 rounded-full animate-pulse',
                  isReceived
                    ? 'bg-success shadow-[0_0_8px_rgba(var(--success-rgb),0.6)] animate-none'
                    : 'bg-warning shadow-[0_0_8px_rgba(var(--warning-rgb),0.6)]',
                )} />
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">{m.component_name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                    <span className={cn(isReceived ? 'text-success' : 'text-warning')}>{statusLabel}</span>
                    <span>•</span>
                    <span>{m.supplier_name}</span>
                    <span>•</span>
                    <span>Cant: {m.quantity_planned} {m.uom_name}</span>
                    <span>•</span>
                    <span>OC: {m.purchase_order_number ?? '---'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {m.purchase_order_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-8"
                    onClick={() => openHub({ orderId: m.purchase_order_id, type: 'purchase' })}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Abrir HUB de OC
                  </Button>
                )}
                <StatusBadge status={isReceived ? 'RECEIVED' : 'PENDING'} size="sm" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
