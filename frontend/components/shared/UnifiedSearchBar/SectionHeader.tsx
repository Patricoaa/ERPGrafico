'use client'

import type { LucideIcon } from 'lucide-react'

/**
 * Section label of the UnifiedSearchBar menu.
 * Uses the canonical table-header token (`text-3xs font-bold uppercase tracking-widest`)
 * so the menu reads as part of the data surface, not as a separate panel.
 */
export function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
      <Icon className="size-3" aria-hidden />
      {label}
    </div>
  )
}
