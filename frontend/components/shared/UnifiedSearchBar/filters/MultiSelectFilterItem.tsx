'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { MultiSelectFilterDef } from '@/types/unified-search'

interface MultiSelectFilterItemProps {
  def: MultiSelectFilterDef
  selectedValues: string[]
  activeParams: Set<string>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function MultiSelectFilterItem({
  def,
  selectedValues,
  activeParams,
  onApply,
  onRemove,
}: MultiSelectFilterItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isActive = activeParams.has(def.serverParam)

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
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium rounded-sm hover:bg-accent/50",
          isActive && "text-primary",
        )}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", expanded && "rotate-90")} />
        <span>{def.label}</span>
        {selectedValues.length > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {selectedValues.length} seleccionados
          </span>
        )}
        {isActive && selectedValues.length === 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">✓</span>
        )}
      </button>

      {expanded && (
        <div className="ml-4 border-l border-border/40 pl-2 py-1 space-y-0.5">
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
      )}
    </div>
  )
}
