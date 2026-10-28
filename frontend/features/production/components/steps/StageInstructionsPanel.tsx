"use client"

import { FileText } from 'lucide-react'
import { StepEmptyPanel } from '../shared/StepEmptyPanel'

/** The technical instructions recorded for a production phase (from the manufacturing config). */
export function StageInstructionsPanel({ title, text }: { title: string; text?: string | null }) {
  if (!text || text.trim().length === 0) {
    return (
      <StepEmptyPanel
        icon={FileText}
        title="Sin indicaciones registradas"
        description="La configuración de fabricación no tiene indicaciones para esta fase."
      />
    )
  }
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        {title}
      </h4>
      <p className="rounded-md border bg-card px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-line">{text}</p>
    </section>
  )
}
