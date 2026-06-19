'use client'

import React, { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, X, ChevronDown } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import type { SegmentationDefinition, TabSegmentDef, DateSegmentDef, SegmentDef } from '@/types/segmentation'
import { useSegmentation } from './useSegmentation'

interface SegmentationBarProps {
  def: SegmentationDefinition
}

export function SegmentationBar({ def }: SegmentationBarProps) {
  const { filters, apply, remove } = useSegmentation(def)

  return (
    <>
      {def.segments.map((segment) => (
        <div key={segment.key} className="flex items-center shrink-0 bg-muted/30 rounded-sm px-1 h-9">
          <SegmentItem
            segment={segment}
            filters={filters}
            apply={apply}
            remove={remove}
          />
        </div>
      ))}
    </>
  )
}

/* ─── SegmentItem ─── */

interface SegmentItemProps {
  segment: SegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function SegmentItem({ segment, filters, apply, remove }: SegmentItemProps) {
  if (segment.type === 'tabs') {
    const variant = segment.variant ?? 'tabs'
    if (variant === 'dropdown') {
      return <DropdownSegment def={segment} filters={filters} apply={apply} remove={remove} />
    }
    return <TabsSegment def={segment} filters={filters} apply={apply} remove={remove} />
  }
  return <DateSegment def={segment} filters={filters} apply={apply} remove={remove} />
}

/* ─── TabsSegment ─── */

interface TabsSegmentProps {
  def: TabSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function TabsSegment({ def, filters, apply, remove }: TabsSegmentProps) {
  const currentValue = filters[def.serverParam] ?? ''

  const handleChange = useCallback((value: string) => {
    if (value === '') {
      remove(def.serverParam)
    } else {
      apply(def.serverParam, value)
    }
  }, [def.serverParam, apply, remove])

  return (
    <Tabs value={currentValue} onValueChange={handleChange}>
      <TabsList className="h-7 p-0 gap-0 bg-transparent border-border/60 shrink-0">
        <TabsTrigger
          value=""
          className="h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm"
        >
          Todos
        </TabsTrigger>
        {def.options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className="h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm"
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/* ─── DropdownSegment ─── */

interface DropdownSegmentProps {
  def: TabSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function DropdownSegment({ def, filters, apply, remove }: DropdownSegmentProps) {
  const currentValue = filters[def.serverParam]
  const currentLabel = currentValue
    ? def.options.find((o) => o.value === currentValue)?.label
    : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 rounded-sm shrink-0',
            currentValue
              ? 'bg-accent/50 text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {currentLabel ?? def.label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px] p-1">
        <DropdownMenuRadioGroup
          value={currentValue ?? ''}
          onValueChange={(value) => {
            if (value === '') {
              remove(def.serverParam)
            } else {
              apply(def.serverParam, value)
            }
          }}
        >
          <DropdownMenuRadioItem value="" className="text-[10px] uppercase tracking-widest">
            Todos
          </DropdownMenuRadioItem>
          {def.options.map((opt) => (
            <DropdownMenuRadioItem
              key={opt.value}
              value={opt.value}
              className="text-[10px] uppercase tracking-widest"
            >
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── DateSegment ─── */

type DateMode = 'all' | 'single' | 'range'

interface DateSegmentProps {
  def: DateSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

/** Parse "yyyy-MM-dd" string as local-midnight Date (avoids UTC timezone offset). */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function DateSegment({ def, filters, apply, remove }: DateSegmentProps) {
  const [open, setOpen] = useState(false)

  const singleVal = def.serverParamDate ? filters[def.serverParamDate] : undefined
  const fromVal = def.serverParamFrom ? filters[def.serverParamFrom] : undefined
  const toVal = def.serverParamTo ? filters[def.serverParamTo] : undefined

  const mode: DateMode = fromVal || toVal ? 'range' : singleVal ? 'single' : 'all'

  const [tempMode, setTempMode] = useState<DateMode>(mode)
  const [tempSingle, setTempSingle] = useState<Date | undefined>(
    singleVal ? parseDateLocal(singleVal) : undefined,
  )
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    fromVal ? { from: parseDateLocal(fromVal), to: toVal ? parseDateLocal(toVal) : undefined } : undefined,
  )

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setTempMode(mode)
      setTempSingle(singleVal ? parseDateLocal(singleVal) : undefined)
      setTempRange(
        fromVal
          ? { from: parseDateLocal(fromVal), to: toVal ? parseDateLocal(toVal) : undefined }
          : undefined,
      )
    }
    setOpen(newOpen)
  }, [mode, singleVal, fromVal, toVal])

  const handleApply = useCallback(async () => {
    if (tempMode === 'all') {
      if (def.serverParamDate) await remove(def.serverParamDate)
      if (def.serverParamFrom) await remove(def.serverParamFrom)
      if (def.serverParamTo) await remove(def.serverParamTo)
    } else if (tempMode === 'single' && tempSingle && def.serverParamDate) {
      if (def.serverParamFrom) await remove(def.serverParamFrom)
      if (def.serverParamTo) await remove(def.serverParamTo)
      await apply(def.serverParamDate, format(tempSingle, 'yyyy-MM-dd'))
    } else if (tempMode === 'range' && tempRange?.from) {
      if (def.serverParamDate) await remove(def.serverParamDate)
      if (def.serverParamFrom) await apply(def.serverParamFrom, format(tempRange.from, 'yyyy-MM-dd'))
      if (tempRange.to && def.serverParamTo) {
        await apply(def.serverParamTo, format(tempRange.to, 'yyyy-MM-dd'))
      } else if (def.serverParamTo) {
        await remove(def.serverParamTo)
      }
    }
    setOpen(false)
  }, [tempMode, tempSingle, tempRange, def, apply, remove])

  const label = mode === 'single' && singleVal
    ? format(parseDateLocal(singleVal), 'dd/MM/yy', { locale: es })
    : mode === 'range' && fromVal
      ? `${format(parseDateLocal(fromVal), 'dd/MM/yy', { locale: es })} - ${toVal ? format(parseDateLocal(toVal), 'dd/MM/yy', { locale: es }) : '...'}`
      : null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 rounded-sm shrink-0',
            mode !== 'all'
              ? 'bg-accent/50 text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <CalendarIcon className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{label ?? def.label}</span>
          {mode !== 'all' && (
            <X
              className="h-2.5 w-2.5 ml-0.5 hover:text-destructive"
              onPointerDown={(e) => {
                e.stopPropagation()
                if (def.serverParamDate) remove(def.serverParamDate)
                if (def.serverParamFrom) remove(def.serverParamFrom)
                if (def.serverParamTo) remove(def.serverParamTo)
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3" sideOffset={4}>
        <div className="flex flex-col gap-3">
          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTempMode('all')}
              className={cn(
                'px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest rounded-sm transition-colors',
                tempMode === 'all'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTempMode('single')}
              className={cn(
                'px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest rounded-sm transition-colors',
                tempMode === 'single'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              Fecha única
            </button>
            <button
              type="button"
              onClick={() => setTempMode('range')}
              className={cn(
                'px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest rounded-sm transition-colors',
                tempMode === 'range'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              Rango
            </button>
          </div>

          {/* Calendar */}
          {tempMode !== 'all' && (
            <div className="flex justify-center">
              {tempMode === 'single' ? (
                <Calendar
                  mode="single"
                  selected={tempSingle}
                  onSelect={setTempSingle}
                  locale={es}
                  numberOfMonths={1}
                  captionLayout="dropdown"
                />
              ) : (
                <Calendar
                  mode="range"
                  selected={tempRange}
                  onSelect={setTempRange}
                  locale={es}
                  numberOfMonths={2}
                  captionLayout="dropdown"
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] uppercase tracking-widest"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-[10px] uppercase tracking-widest"
              onClick={handleApply}
              disabled={
                (tempMode === 'single' && !tempSingle) ||
                (tempMode === 'range' && !tempRange?.from)
              }
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
