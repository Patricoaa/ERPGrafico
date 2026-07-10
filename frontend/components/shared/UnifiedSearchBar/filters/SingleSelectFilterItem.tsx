'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SingleSelectFilterDef } from '@/types/unified-search'

interface SingleSelectFilterItemProps {
  def: SingleSelectFilterDef
  selectedValue: string
  activeParams: Set<string>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function SingleSelectFilterItem({
  def,
  selectedValue,
  activeParams,
  onApply,
  onRemove,
}: SingleSelectFilterItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isActive = activeParams?.has(def.serverParam) ?? false

  const handleSelect = (optValue: string) => {
    if (optValue === selectedValue) {
      onRemove(def.serverParam)
    } else {
      onApply(def.serverParam, optValue)
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
        {selectedValue && (
          <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[100px]">
            {def.options.find(o => o.value === selectedValue)?.label ?? selectedValue}
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-4 border-l border-border/40 pl-2 py-1 space-y-0.5">
          {def.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "block w-full text-left px-2 py-1 text-xs rounded-sm hover:bg-accent/50",
                selectedValue === opt.value
                  ? "text-primary font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
