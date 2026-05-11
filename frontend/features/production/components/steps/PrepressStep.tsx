"use client"

import { FileText, Package, Layers, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatBytes } from '@/lib/utils'
import { ApprovalTaskList } from './ApprovalTaskList'
import type { WorkOrder, WorkOrderTask, ProductionAttachment } from '../../types'

interface PrepressStepProps {
  order: WorkOrder
  stageData: WorkOrder['stage_data']
  canComplete: (task: WorkOrderTask) => boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
}

export function PrepressStep({
  order, stageData, canComplete, taskNotes, taskFiles, onNoteChange, onFileChange,
}: PrepressStepProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-primary/5 border border-primary/10 rounded-md space-y-3">
        <div className="space-y-4">
          {order.checkout_files && order.checkout_files.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5">
                <Package className="h-3 w-3" />
                Archivos del Checkout (Compra)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {order.checkout_files.map((att: ProductionAttachment) => (
                  <div key={att.id} className="flex items-center gap-2 p-2 bg-primary/10/50 rounded border border-primary/10/50 text-xs hover:border-primary/20 transition-colors">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="flex-1 truncate font-medium text-primary" title={att.original_filename}>
                      {att.original_filename}
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {formatBytes(Number(att.file_size ?? 0))}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 text-primary"
                      onClick={() => window.open(att.file, '_blank')} title="Descargar">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.attachments && order.attachments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5">
                <Layers className="h-3 w-3" />
                Archivos Adjuntos a la OT
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {order.attachments
                  .filter((a: ProductionAttachment) => a.original_filename !== stageData?.approval_attachment)
                  .map((att: ProductionAttachment) => (
                    <div key={att.id} className="flex items-center gap-2 p-2 bg-white/50 rounded border border-primary/20 text-xs hover:border-primary/40 transition-colors">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="flex-1 truncate font-medium" title={att.original_filename}>
                        {att.original_filename}
                      </div>
                      <div className="text-[10px] text-muted-foreground shrink-0">
                        {formatBytes(Number(att.file_size ?? 0))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10"
                        onClick={() => window.open(att.file, '_blank')} title="Descargar">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ApprovalTaskList
        tasks={order.workflow_tasks ?? []}
        taskType="OT_PREPRESS_APPROVAL"
        canComplete={canComplete}
        taskNotes={taskNotes}
        taskFiles={taskFiles}
        onNoteChange={onNoteChange}
        onFileChange={onFileChange}
      />
    </div>
  )
}
