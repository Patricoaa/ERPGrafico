'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, X, ChevronDown, Check } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import type { Table } from '@tanstack/react-table'
import { SEG_TEXT, SEG_WRAPPER, SEG_TRIGGER, SEG_ACTIVE, SEG_INACTIVE, SEG_DROPDOWN_ITEM, SEG_MENU_ITEM, SEG_CHECKBOX, SEG_INPUT } from './styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { SegmentationDefinition, TabSegmentDef, DateSegmentDef, PeriodSegmentDef, RangeSegmentDef, MultiSelectSegmentDef, CustomSegmentDef, SegmentDef } from '@/types/segmentation'
import { useSegmentation } from './useSegmentation'
import { useSegmentationTable } from './context'

interface SegmentationBarProps<TData> {
  def: SegmentationDefinition
  basePeriod?: {
    serverParamFrom: string
    serverParamTo: string
  }
  table?: Table<TData>
}

export function SegmentationBar<TData>({ def, basePeriod, table: explicitTable }: SegmentationBarProps<TData>) {
  const contextTable = useSegmentationTable<TData>()
  const table = explicitTable ?? contextTable ?? undefined
  const effectiveDef = useMemo(() => {
    if (!basePeriod) return def
    return {
      segments: [
        { key: '_base_period', label: 'Período', type: 'period', serverParamFrom: basePeriod.serverParamFrom, serverParamTo: basePeriod.serverParamTo } as PeriodSegmentDef,
        ...def.segments,
      ],
    }
  }, [def, basePeriod])

  const { filters, apply, remove } = useSegmentation(effectiveDef)

  return (
    <>
      {basePeriod && (
        <div className={SEG_WRAPPER}>
          <BasePeriodSegment
            serverParamFrom={basePeriod.serverParamFrom}
            serverParamTo={basePeriod.serverParamTo}
            filters={filters}
            apply={apply}
            remove={remove}
          />
        </div>
      )}
      {def.segments.map((segment) => (
        <div key={segment.key} className={SEG_WRAPPER}>
          <SegmentItem
            segment={segment}
            filters={filters}
            apply={apply}
            remove={remove}
            table={table}
          />
        </div>
      ))}
    </>
  )
}

/* ─── SegmentItem ─── */

interface SegmentItemProps<TData> {
  segment: SegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
  table?: Table<TData>
}

function SegmentItem<TData>({ segment, filters, apply, remove, table }: SegmentItemProps<TData>) {
  if (segment.type === 'period') {
    return <PeriodSegment def={segment} filters={filters} apply={apply} remove={remove} />
  }
  if (segment.type === 'range') {
    return <RangeSegment def={segment} filters={filters} apply={apply} remove={remove} />
  }
  if (segment.type === 'tabs') {
    const variant = segment.variant ?? 'tabs'
    if (variant === 'dropdown') {
      return <DropdownSegment def={segment} filters={filters} apply={apply} remove={remove} />
    }
    return <TabsSegment def={segment} filters={filters} apply={apply} remove={remove} />
  }
  if (segment.type === 'multiselect') {
    if (segment.dynamic && table && segment.columnId) {
      return <DynamicMultiSelectSegment def={segment} filters={filters} apply={apply} remove={remove} table={table} />
    }
    return <MultiSelectSegment def={segment} filters={filters} apply={apply} remove={remove} />
  }
  if (segment.type === 'custom') {
    return <CustomSegment def={segment} apply={apply} remove={remove} filters={filters} />
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
        {!def.defaultValue && (
          <TabsTrigger
            value=""
            className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
          >
            Todos
          </TabsTrigger>
        )}
        {def.options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
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
            SEG_TRIGGER,
            currentValue ? SEG_ACTIVE : SEG_INACTIVE,
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
          <DropdownMenuRadioItem value="" className={SEG_DROPDOWN_ITEM}>
            Todos
          </DropdownMenuRadioItem>
          {def.options.map((opt) => {
            const Icon = opt.icon
            return (
              <DropdownMenuRadioItem
                key={opt.value}
                value={opt.value}
                className={SEG_DROPDOWN_ITEM}
              >
                {Icon && <Icon className="mr-2 h-3.5 w-3.5 opacity-70 shrink-0" />}
                {opt.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── PeriodSegment ─── */

type PeriodValue = '' | 'today' | 'this_month' | 'this_year'

const PERIOD_OPTIONS: { label: string; value: PeriodValue }[] = [
  { label: 'Hoy', value: 'today' },
  { label: 'Este Mes', value: 'this_month' },
  { label: 'Este Año', value: 'this_year' },
]

function getPeriodDateRange(value: PeriodValue): { from: string; to: string } | null {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (value) {
    case 'today': {
      const d = format(now, 'yyyy-MM-dd')
      return { from: d, to: d }
    }
    case 'this_month': {
      const from = format(new Date(y, m, 1), 'yyyy-MM-dd')
      const to = format(new Date(y, m + 1, 0), 'yyyy-MM-dd')
      return { from, to }
    }
    case 'this_year': {
      const from = format(new Date(y, 0, 1), 'yyyy-MM-dd')
      const to = format(new Date(y, 11, 31), 'yyyy-MM-dd')
      return { from, to }
    }
    default:
      return null
  }
}

interface PeriodSegmentProps {
  def: PeriodSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function PeriodSegment({ def, filters, apply, remove }: PeriodSegmentProps) {
  const fromVal = filters[def.serverParamFrom]
  const toVal = filters[def.serverParamTo]
  const currentValue: PeriodValue = (['today', 'this_month', 'this_year'] as PeriodValue[]).find((pv) => {
    const range = getPeriodDateRange(pv)
    return range?.from === fromVal && range?.to === toVal
  }) ?? ''

  const handleChange = useCallback(async (value: string) => {
    if (value === '') {
      await remove(def.serverParamFrom)
      await remove(def.serverParamTo)
    } else {
      const range = getPeriodDateRange(value as PeriodValue)
      if (range) {
        await apply(def.serverParamFrom, range.from)
        await apply(def.serverParamTo, range.to)
      }
    }
  }, [def, apply, remove])

  return (
    <Tabs value={currentValue} onValueChange={handleChange}>
      <TabsList className="h-7 p-0 gap-0 bg-transparent border-border/60 shrink-0">
        <TabsTrigger
          value=""
          className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
        >
          Todos
        </TabsTrigger>
        {PERIOD_OPTIONS.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/* ─── BasePeriodSegment ─── */

interface BasePeriodSegmentProps {
  serverParamFrom: string
  serverParamTo: string
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function BasePeriodSegment({ serverParamFrom, serverParamTo, filters, apply, remove }: BasePeriodSegmentProps) {
  const fromVal = filters[serverParamFrom]
  const toVal = filters[serverParamTo]

  const activePreset: PeriodValue = (['today', 'this_month', 'this_year'] as PeriodValue[]).find((pv) => {
    const range = getPeriodDateRange(pv)
    return range?.from === fromVal && range?.to === toVal
  }) ?? ''

  const hasCustomRange = !!((fromVal || toVal) && !activePreset)

  const [rangeOpen, setRangeOpen] = useState(false)
  const [tempRange, setTempRange] = useState<DateRange | undefined>()

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setTempRange(
        fromVal
          ? { from: parseDateLocal(fromVal), to: toVal ? parseDateLocal(toVal) : undefined }
          : undefined,
      )
    }
    setRangeOpen(open)
  }, [fromVal, toVal])

  const handleRangeApply = useCallback(async () => {
    if (tempRange?.from) {
      await apply(serverParamFrom, format(tempRange.from, 'yyyy-MM-dd'))
      if (tempRange.to) {
        await apply(serverParamTo, format(tempRange.to, 'yyyy-MM-dd'))
      } else {
        await remove(serverParamTo)
      }
    }
    setRangeOpen(false)
  }, [tempRange, serverParamFrom, serverParamTo, apply, remove])

  const handleRangeClear = useCallback(async () => {
    setTempRange(undefined)
    await remove(serverParamFrom)
    await remove(serverParamTo)
    setRangeOpen(false)
  }, [serverParamFrom, serverParamTo, remove])

  const handlePreset = useCallback((value: string) => {
    if (value === '') {
      remove(serverParamFrom)
      remove(serverParamTo)
    } else {
      const range = getPeriodDateRange(value as PeriodValue)
      if (range) {
        apply(serverParamFrom, range.from)
        apply(serverParamTo, range.to)
      }
    }
  }, [serverParamFrom, serverParamTo, apply, remove])

  const customLabel = hasCustomRange
    ? `${format(parseDateLocal(fromVal as string), 'dd/MM/yy', { locale: es })} — ${toVal ? format(parseDateLocal(toVal), 'dd/MM/yy', { locale: es }) : '...'}`
    : null

  const btnClass = (isActive: boolean) =>
    cn(
      SEG_TRIGGER,
      isActive ? `${SEG_ACTIVE} shadow-none` : SEG_INACTIVE,
    )

  return (
    <div className="flex items-center gap-0 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handlePreset('')}
        className={btnClass(!fromVal && !toVal)}
      >
        Todos
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handlePreset('today')}
        className={btnClass(activePreset === 'today')}
      >
        Hoy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handlePreset('this_month')}
        className={btnClass(activePreset === 'this_month')}
      >
        Este Mes
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handlePreset('this_year')}
        className={btnClass(activePreset === 'this_year')}
      >
        Este Año
      </Button>
      <Popover open={rangeOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(btnClass(hasCustomRange), 'flex items-center gap-1')}
          >
            {customLabel ? (
              <>
                <CalendarIcon className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{customLabel}</span>
                <X
                  className="h-2.5 w-2.5 ml-0.5 hover:text-destructive shrink-0"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    handleRangeClear()
                  }}
                />
              </>
            ) : (
              'Rango'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3" sideOffset={4}>
          <div className="flex flex-col gap-3">
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={tempRange}
                onSelect={setTempRange}
                locale={es}
                numberOfMonths={2}
                captionLayout="dropdown"
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`h-7 ${SEG_DROPDOWN_ITEM}`}
                onClick={handleRangeClear}
                disabled={!fromVal && !toVal}
              >
                Limpiar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-7 ${SEG_DROPDOWN_ITEM}`}
                  onClick={() => setRangeOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className={`h-7 ${SEG_DROPDOWN_ITEM}`}
                  onClick={handleRangeApply}
                  disabled={!tempRange?.from}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* ─── RangeSegment ─── */

interface RangeSegmentProps {
  def: RangeSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function RangeSegment({ def, filters, apply, remove }: RangeSegmentProps) {
  const [open, setOpen] = useState(false)

  const fromVal = filters[def.serverParamFrom] ?? ''
  const toVal = filters[def.serverParamTo] ?? ''

  const [tempFrom, setTempFrom] = useState(fromVal)
  const [tempTo, setTempTo] = useState(toVal)

  const hasValue = fromVal !== '' || toVal !== ''

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setTempFrom(fromVal)
      setTempTo(toVal)
    }
    setOpen(newOpen)
  }, [fromVal, toVal])

  const handleApply = useCallback(async () => {
    if (tempFrom) {
      await apply(def.serverParamFrom, tempFrom)
    } else {
      await remove(def.serverParamFrom)
    }
    if (tempTo) {
      await apply(def.serverParamTo, tempTo)
    } else {
      await remove(def.serverParamTo)
    }
    setOpen(false)
  }, [tempFrom, tempTo, def, apply, remove])

  const handleClear = useCallback(async () => {
    setTempFrom('')
    setTempTo('')
    await remove(def.serverParamFrom)
    await remove(def.serverParamTo)
    setOpen(false)
  }, [def, remove])

  const label = hasValue
    ? `${fromVal}${toVal ? ` — ${toVal}` : ' — ...'}`
    : null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            SEG_TRIGGER,
            hasValue ? SEG_ACTIVE : SEG_INACTIVE,
          )}
        >
          <span className="truncate max-w-[160px]">{label ?? def.label}</span>
          {hasValue && (
            <X
              className="h-2.5 w-2.5 ml-0.5 hover:text-destructive"
              onPointerDown={(e) => {
                e.stopPropagation()
                remove(def.serverParamFrom)
                remove(def.serverParamTo)
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3" sideOffset={4}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={tempFrom}
              onChange={(e) => setTempFrom(e.target.value)}
              placeholder={def.placeholderFrom ?? 'Desde'}
              className={`${SEG_INPUT} w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
            />
            <span className={`${SEG_TEXT} text-muted-foreground/50`}>—</span>
            <Input
              type="number"
              value={tempTo}
              onChange={(e) => setTempTo(e.target.value)}
              placeholder={def.placeholderTo ?? 'Hasta'}
              className={`${SEG_INPUT} w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-7 ${SEG_DROPDOWN_ITEM}`}
              onClick={handleClear}
              disabled={!hasValue}
            >
              Limpiar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`h-7 ${SEG_DROPDOWN_ITEM}`}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className={`h-7 ${SEG_DROPDOWN_ITEM}`}
                onClick={handleApply}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ─── MultiSelectSegment ─── */

interface MultiSelectSegmentProps {
  def: MultiSelectSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
}

function MultiSelectSegment({ def, filters, apply, remove }: MultiSelectSegmentProps) {
  const [open, setOpen] = useState(false)
  const rawValue = filters[def.serverParam] ?? ''
  const selectedValues = rawValue ? rawValue.split(',').filter(Boolean) : []

  const currentLabel = selectedValues.length > 0
    ? selectedValues.map(v => def.options.find(o => o.value === v)?.label).filter(Boolean).join(', ')
    : null

  const toggleOption = async (optionValue: string) => {
    const next = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue]
    if (next.length === 0) {
      await remove(def.serverParam)
    } else {
      await apply(def.serverParam, next.join(','))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            SEG_TRIGGER,
            selectedValues.length > 0 ? SEG_ACTIVE : SEG_INACTIVE,
          )}
        >
          <span className="truncate max-w-[120px]">{currentLabel ?? def.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1" sideOffset={4}>
        <div className="flex flex-col">
          {def.options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value)
            const Icon = opt.icon
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  SEG_MENU_ITEM,
                  isSelected ? 'bg-primary/5 text-primary' : 'text-muted-foreground',
                )}
                onClick={() => toggleOption(opt.value)}
              >
                <div className={cn(
                  SEG_CHECKBOX,
                  isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border',
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </div>
                {Icon && <Icon className="mr-2 h-3.5 w-3.5 opacity-70 shrink-0" />}
                <span className="flex-1">{opt.label}</span>
              </div>
            )
          })}
        </div>
        {selectedValues.length > 0 && (
          <div
            role="button"
            className={`w-full flex items-center justify-center ${SEG_TEXT} tracking-[0.1em] h-7 mt-1 hover:bg-destructive/10 hover:text-destructive transition-colors rounded-sm text-muted-foreground/60 cursor-pointer`}
            onClick={async () => { await remove(def.serverParam); setOpen(false) }}
          >
            Limpiar
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* ─── DynamicMultiSelectSegment ─── */

interface DynamicMultiSelectSegmentProps<TData> {
  def: MultiSelectSegmentDef
  filters: Record<string, string>
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
  table: Table<TData>
}

function DynamicMultiSelectSegment<TData>({ def, filters, apply, remove, table }: DynamicMultiSelectSegmentProps<TData>) {
  const [open, setOpen] = useState(false)

  const column = table.getColumn(def.columnId ?? '')

  const dynamicOptions = useMemo(() => {
    if (!column) return def.options ?? []
    const uniqueValues = column.getFacetedUniqueValues()
    return Array.from(uniqueValues.keys())
      .filter(val => val !== undefined && val !== null && val !== '')
      .map(val => ({
        label: String(val),
        value: String(val),
        icon: undefined as React.ComponentType<{ className?: string }> | undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [column, def.options])

  const options = dynamicOptions.length > 0 ? dynamicOptions : (def.options ?? [])

  const rawValue = filters[def.serverParam] ?? ''
  const selectedValues = rawValue ? rawValue.split(',').filter(Boolean) : []

  const currentLabel = selectedValues.length > 0
    ? selectedValues.map(v => options.find(o => o.value === v)?.label).filter(Boolean).join(', ')
    : null

  const syncColumn = useCallback((values: string[]) => {
    if (column) {
      column.setFilterValue(values.length > 0 ? values : undefined)
    }
  }, [column])

  const toggleOption = useCallback(async (optionValue: string) => {
    const next = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue]
    syncColumn(next)
    if (next.length === 0) {
      await remove(def.serverParam)
    } else {
      await apply(def.serverParam, next.join(','))
    }
  }, [selectedValues, syncColumn, def.serverParam, apply, remove])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            SEG_TRIGGER,
            selectedValues.length > 0 ? SEG_ACTIVE : SEG_INACTIVE,
          )}
        >
          <span className="truncate max-w-[120px]">{currentLabel ?? def.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1" sideOffset={4}>
        <div className="flex flex-col">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value)
            const Icon = opt.icon
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  SEG_MENU_ITEM,
                  isSelected ? 'bg-primary/5 text-primary' : 'text-muted-foreground',
                )}
                onClick={() => toggleOption(opt.value)}
              >
                <div className={cn(
                  SEG_CHECKBOX,
                  isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border',
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </div>
                {Icon && <Icon className="mr-2 h-3.5 w-3.5 opacity-70 shrink-0" />}
                <span className="flex-1">{opt.label}</span>
              </div>
            )
          })}
        </div>
        {selectedValues.length > 0 && (
          <div
            role="button"
            className={`w-full flex items-center justify-center ${SEG_TEXT} tracking-[0.1em] h-7 mt-1 hover:bg-destructive/10 hover:text-destructive transition-colors rounded-sm text-muted-foreground/60 cursor-pointer`}
            onClick={async () => { syncColumn([]); await remove(def.serverParam); setOpen(false) }}
          >
            Limpiar
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* ─── CustomSegment ─── */

interface CustomSegmentProps {
  def: CustomSegmentDef
  apply: (param: string, value: string) => Promise<void>
  remove: (param: string) => Promise<void>
  filters: Record<string, string>
}

function CustomSegment({ def, apply, remove, filters }: CustomSegmentProps) {
  const isActive = def.serverParam ? !!filters[def.serverParam] : false

  const wrappedApply = useCallback(async (value: string) => {
    if (def.serverParam) {
      await apply(def.serverParam, value)
    }
  }, [def.serverParam, apply])

  const wrappedRemove = useCallback(async () => {
    if (def.serverParam) {
      await remove(def.serverParam)
    }
  }, [def.serverParam, remove])

  return <>{def.render({ apply: wrappedApply, remove: wrappedRemove, isActive })}</>
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
            SEG_TRIGGER,
            mode !== 'all' ? SEG_ACTIVE : SEG_INACTIVE,
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTempMode('all')}
              className={cn(
                SEG_TRIGGER,
                tempMode === 'all' ? SEG_ACTIVE : SEG_INACTIVE,
              )}
            >
              Todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTempMode('single')}
              className={cn(
                SEG_TRIGGER,
                tempMode === 'single' ? SEG_ACTIVE : SEG_INACTIVE,
              )}
            >
              Fecha única
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTempMode('range')}
              className={cn(
                SEG_TRIGGER,
                tempMode === 'range' ? SEG_ACTIVE : SEG_INACTIVE,
              )}
            >
              Rango
            </Button>
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
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-7 ${SEG_DROPDOWN_ITEM}`}
              onClick={async () => {
                if (def.serverParamDate) await remove(def.serverParamDate)
                if (def.serverParamFrom) await remove(def.serverParamFrom)
                if (def.serverParamTo) await remove(def.serverParamTo)
                setOpen(false)
              }}
              disabled={mode === 'all'}
            >
              Limpiar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`h-7 ${SEG_DROPDOWN_ITEM}`}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className={`h-7 ${SEG_DROPDOWN_ITEM}`}
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
