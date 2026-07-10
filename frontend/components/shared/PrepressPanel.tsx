"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { CmykRing } from "./CmykRing"

interface PrepressPanelProps {
  children: React.ReactNode
  className?: string
  id?: string
}

/**
 * PrepressPanel — Dot‑grid canvas with four corner registration marks.
 *
 * Renders the dot‑grid background via the `.canvas‑prepress` CSS class and
 * positions four `<CmykRing />` components (concentric circles) in the
 * corners as prepress registration targets. The marks sit in a stacked
 * wrapper (z‑1, pointer‑events: none) so interactive content flows
 * naturally above them.
 *
 * The `.canvas‑prepress` header‑cleanup CSS rules apply automatically;
 * pass `className` for panel‑surface, rounded corners, shadows, etc.
 */
export function PrepressPanel({ children, className, id }: PrepressPanelProps) {
  return (
    <div id={id} className={cn("canvas-prepress", className)}>
      <div className="absolute inset-4 pointer-events-none z-[1]">
        <CmykRing size="xs" className="absolute top-0 left-0 opacity-80" />
        <CmykRing size="xs" className="absolute top-0 right-0 opacity-80" />
        <CmykRing size="xs" className="absolute bottom-0 left-0 opacity-80" />
        <CmykRing size="xs" className="absolute bottom-0 right-0 opacity-80" />
      </div>
      {children}
    </div>
  )
}
