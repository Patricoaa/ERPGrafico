"use client"

import { ApprovalTaskList } from './ApprovalTaskList'
import type { WorkOrder, WorkOrderTask } from '../../types'

interface PostpressStepProps {
  order: WorkOrder
  canComplete: (task: WorkOrderTask) => boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
}

export function PostpressStep({ order, canComplete, taskNotes, taskFiles, onNoteChange, onFileChange }: PostpressStepProps) {
  return (
    <div className="space-y-6">
      <ApprovalTaskList
        tasks={order.workflow_tasks ?? []}
        taskType="OT_POSTPRESS_APPROVAL"
        canComplete={canComplete}
        taskNotes={taskNotes}
        taskFiles={taskFiles}
        onNoteChange={onNoteChange}
        onFileChange={onFileChange}
      />
    </div>
  )
}
