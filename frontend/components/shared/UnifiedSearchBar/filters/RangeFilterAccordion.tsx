'use client'

import { useState, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { RangeFilterDef } from '@/types/unified-search'

interface RangeFilterAccordionProps {
  def: RangeFilterDef
  activeParams: Set<string>
  currentFrom: string
  currentTo: string
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function RangeFilterAccordion({
  def,
  activeParams,
  currentFrom,
  currentTo,
  onApply,
  onRemove,
}: RangeFilterAccordionProps) {
  const [expanded, setExpanded] = useState(false)
  const [from, setFrom] = useState(currentFrom)
  const [to, setTo] = useState(currentTo)

  const isActive = activeParams.has(def.serverParamFrom) || activeParams.has(def.serverParamTo)

  const handleApply = useCallback(async () => {
    if (from) {
      await onApply(def.serverParamFrom, from)
    } else if (activeParams.has(def.serverParamFrom)) {
      await onRemove(def.serverParamFrom)
    }
    if (to) {
      await onApply(def.serverParamTo, to)
    } else if (activeParams.has(def.serverParamTo)) {
      await onRemove(def.serverParamTo)
    }
  }, [from, to, def.serverParamFrom, def.serverParamTo, activeParams, onApply, onRemove])

  const handleClear = useCallback(async () => {
    setFrom('')
    setTo('')
    if (activeParams.has(def.serverParamFrom)) await onRemove(def.serverParamFrom)
    if (activeParams.has(def.serverParamTo)) await onRemove(def.serverParamTo)
  }, [def.serverParamFrom, def.serverParamTo, activeParams, onRemove])

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
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        <span>{def.label}</span>
        {isActive && <span className="ml-auto text-[10px] text-muted-foreground">✓</span>}
      </button>

      {expanded && (
        <div className="ml-4 border-l border-border/40 pl-2 space-y-1.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">Desde</span>
            <Input
              type="number"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={def.placeholderFrom ?? '0'}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">Hasta</span>
            <Input
              type="number"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={def.placeholderTo ?? '999999'}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleApply}
              className="text-[11px] font-semibold text-primary hover:text-primary/80 px-2 py-0.5 rounded-sm hover:bg-accent/50"
            >
              Aplicar
            </button>
            {(from || to) && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-sm hover:bg-accent/50"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
