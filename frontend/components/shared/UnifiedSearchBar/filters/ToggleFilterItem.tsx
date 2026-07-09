'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface ToggleFilterItemProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ToggleFilterItem({ label, checked, onCheckedChange }: ToggleFilterItemProps) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-sm text-xs font-medium">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} className="h-3.5 w-3.5" />
      <span className="text-foreground">{label}</span>
    </label>
  )
}
