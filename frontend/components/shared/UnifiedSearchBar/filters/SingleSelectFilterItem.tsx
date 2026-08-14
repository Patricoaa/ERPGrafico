'use client'

import { useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SingleSelectFilterDef, MultiSelectOption } from '@/types/unified-search'

interface SingleSelectFilterItemProps {
  def: SingleSelectFilterDef
  selectedValue: string
  activeParams: Set<string>
  filterOptions?: Record<string, MultiSelectOption[]>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function SingleSelectFilterItem({
  def,
  selectedValue,
  activeParams,
  filterOptions,
  onApply,
  onRemove,
}: SingleSelectFilterItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isActive = activeParams?.has(def.serverParam) ?? false

  const options = def.dynamic && filterOptions?.[def.key]
    ? filterOptions[def.key]
    : (def.options ?? [])

  const currentLabel = options.find(o => o.value === selectedValue)?.label ?? selectedValue

  const handleSelect = (optValue: string) => {
    if (optValue === selectedValue) {
      onRemove(def.serverParam)
    } else {
      onApply(def.serverParam, optValue)
    }
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full justify-start gap-2 px-2 py-1.5 text-xs font-medium rounded-sm",
          isActive && "text-primary",
        )}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", expanded && "rotate-90")} />
        <span>{def.label}</span>
        {selectedValue && (
          <span className="ml-auto text-3xs text-muted-foreground truncate max-w-[100px]">
            {currentLabel}
          </span>
        )}
      </Button>

      {expanded && (
        <div className="ml-4 border-l border-border/40 pl-2 py-1 grid grid-cols-3 gap-1">
          {options.length === 0 && def.dynamic && (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground col-span-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando...
            </div>
          )}
          {options.map((opt) => (
            <Button
              key={opt.value}
              variant="ghost"
              size="sm"
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "w-full justify-start px-2 py-1 text-xs rounded-sm truncate min-w-0",
                selectedValue === opt.value
                  ? "text-primary font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
