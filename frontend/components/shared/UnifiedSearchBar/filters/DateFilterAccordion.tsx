'use client'

import { useState } from 'react'
import { ChevronRight, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { type DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import type { DateFilterDef } from '@/types/unified-search'

interface DateFilterAccordionProps {
  def: DateFilterDef
  activeParams: Set<string>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function DateFilterAccordion({ def, activeParams, onApply, onRemove }: DateFilterAccordionProps) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<'presets' | 'custom'>('presets')
  const [tempRange, setTempRange] = useState<DateRange | undefined>()

  const hasActiveOption = def.options.some(o =>
    (o.serverParamFrom && activeParams.has(o.serverParamFrom)) ||
    (o.serverParamTo && activeParams.has(o.serverParamTo))
  )

  const clearDateParams = async () => {
    for (const o of def.options) {
      if (o.serverParamFrom && activeParams.has(o.serverParamFrom)) {
        await onRemove(o.serverParamFrom)
      }
      if (o.serverParamTo && activeParams.has(o.serverParamTo)) {
        await onRemove(o.serverParamTo)
      }
    }
  }

  const handleSelect = async (option: typeof def.options[0]) => {
    await clearDateParams()

    if (option.getValue) {
      const { from, to } = option.getValue()
      if (option.serverParamFrom) await onApply(option.serverParamFrom, from)
      if (option.serverParamTo) await onApply(option.serverParamTo, to)
    } else if (option.serverParamFrom && option.serverParamTo) {
      setExpanded(true)
    }
  }

  const handleCustomApply = async () => {
    if (!tempRange?.from) return
    const from = format(tempRange.from, 'yyyy-MM-dd')
    const to = tempRange.to ? format(tempRange.to, 'yyyy-MM-dd') : from
    const firstOpt = def.options[0]

    await clearDateParams()

    if (firstOpt?.serverParamFrom) await onApply(firstOpt.serverParamFrom, from)
    if (firstOpt?.serverParamTo) await onApply(firstOpt.serverParamTo, to)
    setExpanded(false)
    setMode('presets')
  }

  const handleCustomCancel = () => {
    setTempRange(undefined)
    setMode('presets')
  }

  const isSelected = (option: typeof def.options[0]) => {
    if (option.serverParamFrom && activeParams.has(option.serverParamFrom)) return true
    if (option.serverParamTo && activeParams.has(option.serverParamTo)) return true
    return false
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setExpanded(!expanded)
          if (expanded) setMode('presets')
        }}
        className={cn(
          "w-full justify-start gap-2 font-medium",
          hasActiveOption && "text-primary",
        )}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        <span>{def.label}</span>
        {hasActiveOption && <span className="ml-auto text-[10px] text-muted-foreground">✓</span>}
      </Button>

      {expanded && (
        <div className="ml-4 border-l border-border/40 pl-2 space-y-0.5">
          {mode === 'presets' ? (
            <>
              {def.options.map((option) => (
                <Button
                  key={option.label}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full justify-start font-normal",
                    isSelected(option) ? "text-primary font-semibold" : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </Button>
              ))}
              <div className="border-t border-border/40 my-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMode('custom'); setTempRange(undefined) }}
                className="w-full justify-start gap-1.5 text-muted-foreground"
              >
                <CalendarIcon className="h-3 w-3" />
                Rango personalizado
              </Button>
            </>
          ) : (
            <div className="py-1 space-y-2">
              <Calendar
                mode="range"
                selected={tempRange}
                onSelect={setTempRange}
                numberOfMonths={1}
                locale={es}
                captionLayout="dropdown"
                startMonth={new Date(new Date().getFullYear() - 10, 0)}
                endMonth={new Date(new Date().getFullYear() + 10, 11)}
                className="scale-90 origin-top-left -ml-2"
              />
              <div className="flex gap-2 px-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCustomCancel}
                  className="flex-1"
                >
                  Volver
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCustomApply}
                  disabled={!tempRange?.from}
                  className="flex-1"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
