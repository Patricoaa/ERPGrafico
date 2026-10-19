'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full justify-start gap-2 px-2 py-1.5 text-xs font-medium rounded-sm transition-colors",
          isActive && "bg-primary/5 text-primary",
        )}
      >
        <ChevronRight
          className={cn("size-3 shrink-0 transition-transform motion-reduce:transition-none", expanded && "rotate-90")}
          aria-hidden
        />
        <span>{def.label}</span>
        {isActive && <Check className="ml-auto size-3 shrink-0 text-primary" aria-hidden />}
      </Button>

      {expanded && (
        <div className="ml-4 border-l border-border/50 pl-2 space-y-1.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-3xs text-muted-foreground w-10 shrink-0">Desde</span>
            <Input
              type="number"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={def.placeholderFrom ?? '0'}
              className="h-8 rounded-sm text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-3xs text-muted-foreground w-10 shrink-0">Hasta</span>
            <Input
              type="number"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={def.placeholderTo ?? '999999'}
              className="h-8 rounded-sm text-xs"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleApply}
              className="h-auto px-2 py-0.5 text-2xs font-semibold text-primary hover:text-primary/80 rounded-sm"
            >
              Aplicar
            </Button>
            {(from || to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-auto px-2 py-0.5 text-2xs text-muted-foreground hover:text-foreground rounded-sm"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
