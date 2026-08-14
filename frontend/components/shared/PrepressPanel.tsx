"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface PrepressPanelProps {
  children: React.ReactNode
  className?: string
  id?: string
}

/**
 * PrepressPanel — Dot‑grid canvas.
 *
 * Renders the dot‑grid background via the `.canvas‑prepress` CSS class.
 * Pass `className` for panel‑surface, rounded corners, shadows, etc.
 */
export function PrepressPanel({ children, className, id }: PrepressPanelProps) {
  return (
    <div id={id} className={cn("relative", className)}>
      {children}
    </div>
  )
}
