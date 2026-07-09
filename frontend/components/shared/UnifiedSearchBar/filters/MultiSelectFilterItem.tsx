'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { MultiSelectFilterDef } from '@/types/unified-search'

interface MultiSelectFilterItemProps {
  def: MultiSelectFilterDef
  selectedValues: string[]
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
}

export function MultiSelectFilterItem({
  def,
  selectedValues,
  onApply,
  onRemove,
}: MultiSelectFilterItemProps) {
  const handleToggle = (optValue: string, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const next = [...selectedValues, optValue]
      onApply(def.serverParam, next.join(','))
    } else {
      const next = selectedValues.filter(v => v !== optValue)
      if (next.length > 0) {
        onApply(def.serverParam, next.join(','))
      } else {
        onRemove(def.serverParam)
      }
    }
  }

  return (
    <div className="px-2 py-1.5 space-y-1">
      <div className="text-xs font-medium text-foreground mb-0.5">{def.label}</div>
      <div className="space-y-0.5">
        {def.options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-accent/50 rounded-sm text-xs"
          >
            <Checkbox
              checked={selectedValues.includes(opt.value)}
              onCheckedChange={(checked) => handleToggle(opt.value, checked)}
              className="h-3.5 w-3.5"
            />
            <span className="text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
