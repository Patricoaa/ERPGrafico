'use client'

import { useState } from 'react'
import { ChevronRight, CalendarIcon, Check } from 'lucide-react'
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
          "w-full justify-start gap-2 px-2 py-1.5 text-xs font-medium rounded-sm transition-colors",
          hasActiveOption && "bg-primary/5 text-primary",
        )}
      >
        <ChevronRight
          className={cn("size-3 shrink-0 transition-transform motion-reduce:transition-none", expanded && "rotate-90")}
          aria-hidden
        />
        <span>{def.label}</span>
        {hasActiveOption && <Check className="ml-auto size-3 shrink-0 text-primary" aria-hidden />}
      </Button>

      {expanded && (
        <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5">
          {mode === 'presets' ? (
            <>
              {def.options.map((option) => (
                <Button
                  key={option.label}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full justify-start px-2 py-1.5 text-xs rounded-sm transition-colors",
                    isSelected(option)
                      ? "bg-primary/5 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </Button>
              ))}
              <div className="border-t border-border/50 my-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMode('custom'); setTempRange(undefined) }}
                className="w-full justify-start gap-1.5 px-2 py-1.5 text-xs rounded-sm text-muted-foreground hover:text-foreground"
              >
                <CalendarIcon className="size-3.5" aria-hidden />
                Rango personalizado
              </Button>
            </>
          ) : (
            <div className="py-2 space-y-3 w-full @container">
              <div className="w-full">
                <Calendar
                  mode="range"
                  selected={tempRange}
                  onSelect={setTempRange}
                  numberOfMonths={2}
                  locale={es}
                  captionLayout="dropdown"
                  startMonth={new Date(new Date().getFullYear() - 10, 0)}
                  endMonth={new Date(new Date().getFullYear() + 10, 11)}
                  className="p-0 w-full"
                  classNames={{
                    root: "w-full",
                    months: "flex flex-row gap-4 w-full",
                    month: "w-full space-y-2",
                    table: "w-full border-collapse space-y-1",
                    day: "relative flex aspect-square size-auto w-full min-w-0 flex-col gap-1 text-[min(4cqw,0.85rem)] font-normal leading-none items-center justify-center",
                    weekday: "text-muted-foreground rounded-md flex-1 font-normal text-[min(4cqw,0.85rem)] text-center",
                    caption_label: "text-[min(5cqw,0.9rem)] font-medium",
                  }}
                />
              </div>
              <div className="flex gap-2 pr-2">
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
