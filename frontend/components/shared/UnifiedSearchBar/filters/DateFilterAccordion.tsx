'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DateFilterDef } from '@/types/unified-search'

interface DateFilterAccordionProps {
  def: DateFilterDef
  activeParams: Set<string>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function DateFilterAccordion({ def, activeParams, onApply, onRemove }: DateFilterAccordionProps) {
  const [expanded, setExpanded] = useState(false)

  const hasActiveOption = def.options.some(o =>
    (o.serverParamFrom && activeParams.has(o.serverParamFrom)) ||
    (o.serverParamTo && activeParams.has(o.serverParamTo))
  )

  const handleSelect = async (option: typeof def.options[0]) => {
    for (const o of def.options) {
      if (o.serverParamFrom && activeParams.has(o.serverParamFrom)) {
        await onRemove(o.serverParamFrom)
      }
      if (o.serverParamTo && activeParams.has(o.serverParamTo)) {
        await onRemove(o.serverParamTo)
      }
    }

    if (option.getValue) {
      const { from, to } = option.getValue()
      if (option.serverParamFrom) await onApply(option.serverParamFrom, from)
      if (option.serverParamTo) await onApply(option.serverParamTo, to)
    } else if (option.serverParamFrom && option.serverParamTo) {
      setExpanded(true)
    }
  }

  const isSelected = (option: typeof def.options[0]) => {
    if (option.serverParamFrom && activeParams.has(option.serverParamFrom)) return true
    if (option.serverParamTo && activeParams.has(option.serverParamTo)) return true
    return false
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium rounded-sm hover:bg-accent/50",
          hasActiveOption && "text-primary",
        )}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        <span>{def.label}</span>
        {hasActiveOption && <span className="ml-auto text-[10px] text-muted-foreground">✓</span>}
      </button>

      {expanded && (
        <div className="ml-4 border-l border-border/40 pl-2 space-y-0.5">
          {def.options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleSelect(option)}
              className={cn(
                "block w-full text-left px-2 py-1 text-xs rounded-sm hover:bg-accent/50",
                isSelected(option) ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
