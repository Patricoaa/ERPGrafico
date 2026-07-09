'use client'

import type { GroupByOptionDef } from '@/types/unified-search'

interface GroupBySectionProps {
  options: GroupByOptionDef[]
  currentGroupBy: string | null
  onSelect: (key: string | null) => Promise<void>
}

export function GroupBySection({ options, currentGroupBy, onSelect }: GroupBySectionProps) {
  if (!options.length) return null

  return (
    <div className="space-y-0.5">
      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Agrupar por
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent/50 ${
          currentGroupBy === null ? 'text-primary font-semibold' : 'text-muted-foreground'
        }`}
      >
        Ninguno
      </button>

      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
          className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent/50 ${
            currentGroupBy === option.key ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
