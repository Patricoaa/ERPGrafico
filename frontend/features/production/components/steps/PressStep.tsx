"use client"

import { ApprovalTaskList } from './ApprovalTaskList'
import type { WorkOrder, WorkOrderTask } from '../../types'

interface PressStepProps {
  order: WorkOrder
  canComplete: (task: WorkOrderTask) => boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
}

export function PressStep({ order, canComplete, taskNotes, taskFiles, onNoteChange, onFileChange }: PressStepProps) {
  return (
    <div className="space-y-6">
      <ApprovalTaskList
        tasks={order.workflow_tasks ?? []}
        taskType="OT_PRESS_APPROVAL"
        canComplete={canComplete}
        taskNotes={taskNotes}
        taskFiles={taskFiles}
        onNoteChange={onNoteChange}
        onFileChange={onFileChange}
      />
    </div>
  )
}
