"use client"

import { type ReactNode } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { LabeledContainer } from "./LabeledContainer"
import { cn } from "@/lib/utils"

interface CheckboxItem {
  value: string | number
  label: string
  description?: string
  suffix?: ReactNode
}

interface LabeledCheckboxGroupProps {
  label: string
  items: CheckboxItem[]
  value: (string | number)[]
  onChange: (value: (string | number)[]) => void
  disabled?: boolean
  error?: string
  hint?: string
  suffix?: ReactNode
  selectAll?: boolean
  selectAllLabel?: string
  footer?: ReactNode
  maxHeight?: string
  columns?: 1 | 2 | 3
}

export function LabeledCheckboxGroup({
  label,
  items,
  value,
  onChange,
  disabled,
  error,
  hint,
  selectAll,
  selectAllLabel = "Seleccionar Todas",
  footer,
  suffix,
  columns = 1,
  maxHeight = "180px",
}: LabeledCheckboxGroupProps) {
  const allSelected = items.length > 0 && items.every((item) => value.includes(item.value))
  const someSelected = !allSelected && items.some((item) => value.includes(item.value))

  const toggleSelectAll = () => {
    if (allSelected) {
      onChange(value.filter((v) => !items.some((item) => item.value === v)))
    } else {
      const newValues = [...value]
      for (const item of items) {
        if (!newValues.includes(item.value)) {
          newValues.push(item.value)
        }
      }
      onChange(newValues)
    }
  }

  const isGrid = columns > 1

  return (
    <LabeledContainer label={label} error={error} hint={hint} disabled={disabled} suffix={suffix}>
      <div className="w-full">
        {selectAll && items.length > 0 && (
          <>
            <div
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded",
                disabled ? "cursor-default" : "cursor-pointer transition-colors hover:bg-muted/10"
              )}
              onClick={() => !disabled && toggleSelectAll()}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm font-bold cursor-pointer">{selectAllLabel}</span>
              </div>
              <span className="text-[11px] font-mono font-black text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="border-t border-border/40 mx-2" />
          </>
        )}

        <div
          className="overflow-y-auto scrollbar-thin"
          style={{ maxHeight }}
        >
          <div
            className={cn("py-0.5", isGrid ? "" : "space-y-0.5")}
            style={isGrid ? { display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "0.5rem" } : undefined}
          >
            {items.map((item) => {
              const checked = value.includes(item.value)
              return (
                <div
                  key={String(item.value)}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded",
                    disabled ? "cursor-default" : "cursor-pointer transition-colors hover:bg-muted/10"
                  )}
                  onClick={() => {
                    if (disabled) return
                    if (checked) {
                      onChange(value.filter((v) => v !== item.value))
                    } else {
                      onChange([...value, item.value])
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => {
                        if (disabled) return
                        if (checked) {
                          onChange(value.filter((v) => v !== item.value))
                        } else {
                          onChange([...value, item.value])
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="min-w-0">
                      <span className={cn(
                        "text-sm block truncate",
                        checked ? "text-foreground font-bold" : "text-muted-foreground/70"
                      )}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground block truncate">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.suffix && (
                    <div className="shrink-0 ml-2">
                      {item.suffix}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {footer && (
          <>
            <div className="border-t border-border/40 mx-2" />
            <div className="px-2 py-1.5">
              {footer}
            </div>
          </>
        )}
      </div>
    </LabeledContainer>
  )
}
