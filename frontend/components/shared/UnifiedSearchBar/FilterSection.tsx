'use client'

import { useMemo } from 'react'
import type {
  DropdownFilterDef,
  DateFilterDef,
  ToggleFilterDef,
  RangeFilterDef,
  MultiSelectFilterDef,
  SingleSelectFilterDef,
  CustomFilterDef,
} from '@/types/unified-search'
import { ToggleFilterItem } from './filters/ToggleFilterItem'
import { SingleSelectFilterItem } from './filters/SingleSelectFilterItem'
import { MultiSelectFilterItem } from './filters/MultiSelectFilterItem'
import { DateFilterAccordion } from './filters/DateFilterAccordion'
import { RangeFilterAccordion } from './filters/RangeFilterAccordion'

interface FilterSectionProps {
  filters?: DropdownFilterDef[]
  dateFilters?: DateFilterDef[]
  paramValues: Record<string, string | null>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function FilterSection({
  filters,
  dateFilters,
  paramValues,
  onApply,
  onRemove,
}: FilterSectionProps) {
  const activeParams = useMemo(
    () => new Set(
      Object.entries(paramValues)
        .filter(([, v]) => v !== null)
        .map(([k]) => k)
    ),
    [paramValues],
  )

  if (!filters?.length && !dateFilters?.length) return null

  return (
    <div className="space-y-0.5">
      {filters?.map((filter) => {
        if (filter.type === 'toggle') {
          const tf = filter as ToggleFilterDef
          const isActive = activeParams.has(tf.serverParam)
          return (
            <ToggleFilterItem
              key={tf.key}
              label={tf.label}
              checked={isActive}
              onCheckedChange={(checked) => {
                if (checked) {
                  onApply(tf.serverParam, tf.activeValue ?? '1')
                } else {
                  onRemove(tf.serverParam)
                }
              }}
            />
          )
        }
        if (filter.type === 'multi') {
          const mf = filter as MultiSelectFilterDef
          const currentValue = paramValues[mf.serverParam] ?? ''
          const selectedValues = currentValue ? currentValue.split(',').filter(Boolean) : []
          return (
            <MultiSelectFilterItem
              key={mf.key}
              def={mf}
              selectedValues={selectedValues}
              activeParams={activeParams}
              onApply={onApply}
              onRemove={onRemove}
            />
          )
        }
        if (filter.type === 'single') {
          const sf = filter as SingleSelectFilterDef
          return (
            <SingleSelectFilterItem
              key={sf.key}
              def={sf}
              selectedValue={(paramValues[sf.serverParam] as string) ?? ''}
              activeParams={activeParams}
              onApply={onApply}
              onRemove={onRemove}
            />
          )
        }
        if (filter.type === 'range') {
          const rf = filter as RangeFilterDef
          return (
            <RangeFilterAccordion
              key={rf.key}
              def={rf}
              activeParams={activeParams}
              currentFrom={(paramValues[rf.serverParamFrom] as string) ?? ''}
              currentTo={(paramValues[rf.serverParamTo] as string) ?? ''}
              onApply={onApply}
              onRemove={onRemove}
            />
          )
        }
        if (filter.type === 'custom') {
          const def = filter as CustomFilterDef
          return (
            <div key={def.key}>
              {def.render({
                apply: async (param: string, value: string) => onApply(param, value),
                remove: async (param: string) => onRemove(param),
                isActive: activeParams.has(def.serverParam ?? ''),
              })}
            </div>
          )
        }
        return null
      })}

      {dateFilters?.map((df) => (
        <DateFilterAccordion
          key={df.key}
          def={df}
          activeParams={activeParams}
          onApply={onApply}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
