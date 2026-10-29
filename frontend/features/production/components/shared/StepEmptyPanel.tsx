"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/shared"

interface StepEmptyPanelProps {
  icon: LucideIcon
  title: string
  description?: string
  /** The way out (e.g. "Agregar material") lives inside the frame, never below it. */
  action?: ReactNode
}

/** Empty state of a wizard step: bordered frame that fills the step's available height. */
export function StepEmptyPanel({ icon, title, description, action }: StepEmptyPanelProps) {
  return (
    <div className="flex min-h-48 flex-1 flex-col justify-center rounded-md border">
      <EmptyState context="production" variant="compact" icon={icon} title={title} description={description} action={action} />
    </div>
  )
}
