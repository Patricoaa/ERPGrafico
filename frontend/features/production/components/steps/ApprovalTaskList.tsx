"use client"

import { TaskActionCard } from '@/features/workflow/components/TaskActionCard'
import type { WorkOrderTask } from '../../types'

interface ApprovalTaskListProps {
  tasks: WorkOrderTask[]
  taskType: string
  canComplete: (task: WorkOrderTask) => boolean
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>
  onNoteChange: (taskId: string | number, note: string) => void
  onFileChange: (taskId: string | number, file: File | null) => void
}

/** Renders the approval TaskActionCards for a given task_type filter. */
export function ApprovalTaskList({
  tasks, taskType, canComplete, taskNotes, taskFiles, onNoteChange, onFileChange,
}: ApprovalTaskListProps) {
  const filtered = tasks.filter((t) => t.task_type === taskType)
  if (!filtered.length) return null

  return (
    <>
      {filtered.map((task) => (
        <TaskActionCard
          key={task.id}
          task={task as any}
          canComplete={canComplete(task)}
          notesValue={taskNotes[task.id] ?? ''}
          onNotesChange={(val) => onNoteChange(task.id, val)}
          onFileChange={(file) => onFileChange(task.id, file)}
        />
      ))}
    </>
  )
}
