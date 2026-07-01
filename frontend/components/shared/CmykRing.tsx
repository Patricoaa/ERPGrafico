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

const RINGS =
  'repeating-radial-gradient(circle at center, transparent 0, transparent 1px, var(--mark-color) 1px, var(--mark-color) 2.5px, transparent 2.5px, transparent 4.5px)'

/**
 * CmykRing — Concentric registration‑target rings (círculos concéntricos).
 *
 * Renders repeating prepress registration rings using the same
 * `radial‑gradient` technique and `--mark-color` token as the
 * `.canvas‑prepress` registration marks (⊕) in globals.css.
 *
 * Intended as a reusable visual token — drop it anywhere an element
 * needs a graphic‑industry badge, registration marker, or process‑
 * control accent.
 *
 * Sizes: sm (16px), md (24px), lg (32px). Pass className to add rings,
 * shadows, or other adornments.
 */
export function CmykRing({ size = "md", className }: CmykRingProps) {
  return (
    <div
      className={cn("rounded-full shrink-0", SIZE_MAP[size], className)}
      style={{ background: RINGS }}
    />
  )
}
