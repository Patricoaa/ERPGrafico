'use client'

import { Button } from '@/components/ui/button'
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSelect(null)}
        className={`w-full justify-start px-2 py-1.5 text-xs rounded-sm ${
          currentGroupBy === null ? 'text-primary font-semibold' : 'text-muted-foreground'
        }`}
      >
        Ninguno
      </Button>

      {options.map((option) => (
        <Button
          key={option.key}
          variant="ghost"
          size="sm"
          onClick={() => onSelect(option.key)}
          className={`w-full justify-start px-2 py-1.5 text-xs rounded-sm ${
            currentGroupBy === option.key ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
