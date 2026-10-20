"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CmykRing } from "@/components/shared/CmykRing"

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
 * SelectionRing — Accessible selection indicator using CmykRing.
 *
 * Replaces Checkbox for mass-selection UIs (table rows, select-all headers, card selectors).
 * Uses the CMYK process-colour wheel as the "checked" visual, with a semicircular
 * overlay for the indeterminate (partial) state.
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
  const SIZE_CLASSES: Record<SelectionRingSize, string> = {
    "2xs": "h-4 w-4",
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  }

  const ringSizeMap: Record<SelectionRingSize, "2xs" | "xs" | "sm" | "md" | "lg"> = {
    "2xs": "2xs",
    xs: "xs",
    sm: "sm",
    md: "md",
    lg: "lg",
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

      {/* Checked state: CmykRing */}
      {isChecked && (
        <CmykRing size={ringSizeMap[size]} className="animate-in zoom-in-95 duration-150" />
      )}

      {/* Indeterminate state: CmykRing + semicircular overlay */}
      {isIndeterminate && (
        <div className="relative" aria-hidden="true">
          <CmykRing size={ringSizeMap[size]} className="opacity-60" />
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 24 24"
            preserveAspectRatio="xMidYMid meet"
          >
            <circle
              cx="12"
              cy="12"
              r="9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="59.69 59.69"
              strokeDashoffset="0"
              strokeLinecap="round"
              className="text-primary"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "12px 12px",
              }}
            />
          </svg>
        </div>
      )}
    </button>
  )
}