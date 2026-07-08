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

const CMYK_WHEEL =
  'conic-gradient(from 0deg, var(--color-cyan) 0deg 90deg, var(--color-magenta) 90deg 180deg, var(--color-yellow) 180deg 270deg, var(--color-black) 270deg 360deg)'

/**
 * CmykRing — Four‑quadrant process‑colour wheel (C / M / Y / K).
 *
 * A conic gradient split evenly into cyan, magenta, yellow and black.
 * References the circular process‑colour control patches found on
 * prepress proofing bars and colour‑density measurement targets.
 *
 * Sizes: sm (16px), md (24px), lg (32px). Pass className to add rings,
 * shadows, or other adornments.
 */
export function CmykRing({ size = "md", className }: CmykRingProps) {
  return (
    <div
      className={cn("rounded-full shrink-0", SIZE_MAP[size], className)}
      style={{ background: CMYK_WHEEL }}
    />
  )
}
