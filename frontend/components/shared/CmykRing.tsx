"use client"

import React from "react"
import { cn } from "@/lib/utils"

type RingSize = "sm" | "md" | "lg"

interface CmykRingProps {
  size?: RingSize
  className?: string
}

const SIZE_MAP: Record<RingSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

/**
 * CmykRing — Registration‑target concentric circles in C / M / Y / K.
 *
 * Four concentric rings from centre out: Cyan → Magenta → Yellow → Black.
 * References the prepress registration targets used to verify ink
 * registration (套准标记) on press sheets.
 *
 * Sizes: sm (16px), md (24px), lg (32px). Pass className to add rings,
 * shadows, or other adornments.
 */
export function CmykRing({ size = "md", className }: CmykRingProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", SIZE_MAP[size], className)}
      aria-hidden="true"
    >
      {/* K — outer ring */}
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-black)" strokeWidth="2" />
      {/* Y — ring 2 */}
      <circle cx="12" cy="12" r="7" fill="none" stroke="var(--color-yellow)" strokeWidth="2" />
      {/* M — ring 3 */}
      <circle cx="12" cy="12" r="4" fill="none" stroke="var(--color-magenta)" strokeWidth="2" />
      {/* C — centre dot */}
      <circle cx="12" cy="12" r="1.5" fill="var(--color-cyan)" />
    </svg>
  )
}
