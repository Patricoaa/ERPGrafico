'use client'

import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { MultiSelectFilterDef } from '@/types/unified-search'

interface MultiSelectFilterItemProps {
  def: MultiSelectFilterDef
  selectedValues: string[]
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

function computeGridCols(options: { label: string }[]): number {
  const maxLen = Math.max(...options.map(o => o.label.length), 0)
  if (maxLen <= 6) return 3
  if (maxLen <= 12) return 2
  return 1
}

export function MultiSelectFilterItem({
  def,
  selectedValues,
  onApply,
  onRemove,
}: MultiSelectFilterItemProps) {
  const cols = useMemo(() => computeGridCols(def.options), [def.options])

  const handleToggle = (optValue: string, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const next = [...selectedValues, optValue]
      onApply(def.serverParam, next.join(','))
    } else {
      const next = selectedValues.filter(v => v !== optValue)
      if (next.length > 0) {
        onApply(def.serverParam, next.join(','))
      } else {
        onRemove(def.serverParam)
      }
    }
  }

  return (
    <div className="px-2 py-1.5 space-y-1">
      <div className="text-xs font-medium text-foreground mb-0.5">{def.label}</div>
      <div className={cn(
        "grid gap-x-2 gap-y-0.5",
        cols === 3 && "grid-cols-3",
        cols === 2 && "grid-cols-2",
        cols === 1 && "grid-cols-1",
      )}>
        {def.options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-accent/50 rounded-sm text-xs"
          >
            <Checkbox
              variant="circle"
              checked={selectedValues.includes(opt.value)}
              onCheckedChange={(checked) => handleToggle(opt.value, checked)}
            />
            <span className="text-foreground truncate">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
