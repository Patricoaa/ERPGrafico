"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, Minus } from "lucide-react"

type SelectionRingSize = "2xs" | "xs" | "sm" | "md" | "lg"

interface SelectionRingProps {
  /** Checked state: true = selected, false = unselected, "indeterminate" = partial selection */
  checked?: boolean | "indeterminate"
  /** Called when the user toggles the selection */
  onCheckedChange?: (checked: boolean) => void
  /** Accessible label (required for screen readers) */
  ariaLabel?: string
  /** Disables interaction */
  disabled?: boolean
  /** Visual size — maps to CmykRing sizes */
  size?: SelectionRingSize
  /** Additional className */
  className?: string
  /** Tab index for keyboard navigation */
  tabIndex?: number
}

/**
 * SelectionRing — Accessible selection indicator for bulk selection.
 *
 * Replaces Checkbox for mass-selection UIs (table rows, select-all headers, card selectors).
 * An empty circle that becomes a filled primary circle with a check when selected (and a minus
 * for the partial state) — the same "checked" mark as SelectionCheck on cards (ADR-0097), no CmykRing.
 *
 * Keyboard: Space/Enter toggles. Focus ring follows system focus-visible.
 */
export function SelectionRing({
  checked = false,
  onCheckedChange,
  ariaLabel = "Seleccionar",
  disabled = false,
  size = "sm",
  className,
  tabIndex = 0,
}: SelectionRingProps) {
  const isIndeterminate = checked === "indeterminate"
  const isChecked = checked === true
  const ref = React.useRef<HTMLButtonElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      onCheckedChange?.(!isChecked)
    }
  }

  const handleClick = () => {
    if (disabled) return
    onCheckedChange?.(!isChecked)
  }

  // Size mapping for the inner ring + hit area
  // Matches original Checkbox: h-4 w-4 (16px) hit area with CmykRing xs (12px) inside
  const SIZE_CLASSES: Record<SelectionRingSize, string> = {
    "2xs": "h-3 w-3",
    xs: "h-3.5 w-3.5",
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }

  // The mark is smaller than the circle that holds it
  const CHECK_SIZE: Record<SelectionRingSize, string> = {
    "2xs": "h-2 w-2",
    xs: "h-2 w-2",
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  }

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={isChecked ? "true" : isIndeterminate ? "mixed" : "false"}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : tabIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        SIZE_CLASSES[size],
        className
      )}
    >
      {/* Unchecked state: subtle ring outline */}
      {!isChecked && !isIndeterminate && (
        <div
          className={cn(
            "rounded-full border border-muted-foreground/30 transition-colors",
            SIZE_CLASSES[size]
          )}
          aria-hidden="true"
        />
      )}

      {/* Checked state: filled primary circle with a check (same mark as SelectionCheck on cards) */}
      {isChecked && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-95 duration-150",
            SIZE_CLASSES[size]
          )}
          aria-hidden="true"
        >
          <Check className={CHECK_SIZE[size]} strokeWidth={3} />
        </span>
      )}

      {/* Indeterminate state: filled primary circle with a minus */}
      {isIndeterminate && (
        <span
          className={cn("flex items-center justify-center rounded-full bg-primary text-primary-foreground", SIZE_CLASSES[size])}
          aria-hidden="true"
        >
          <Minus className={CHECK_SIZE[size]} strokeWidth={3} />
        </span>
      )}
    </button>
  )
}