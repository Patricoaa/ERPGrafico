"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ColorBarProps {
  /** Orientation of the bar. Default is 'horizontal'. */
  orientation?: "horizontal" | "vertical"
  /** Whether to show the density scales (100%, 75%, etc.). Default is true. */
  showScales?: boolean
  /** Additional className for the container. */
  className?: string
}

const CMYK_COLORS = [
  { name: "cyan", color: "#00aeef", label: "C" },
  { name: "magenta", color: "#ec008c", label: "M" },
  { name: "yellow", color: "#fff200", label: "Y" },
  { name: "black", color: "#231f20", label: "K" },
]

const SCALES = [100, 75, 50, 25, 10, 5, 0]

/**
 * ColorBar — CMYK Printing Process Control Strip
 *
 * Renders a color control strip used in the printing industry to verify ink density
 * and color consistency. This component reinforces the "Industrial Premium" aesthetic
 * by bringing real-world printing tools into the digital interface.
 *
 * @contract component-contracts.md §10
 */
export function ColorBar({ orientation = "horizontal", showScales = true, className }: ColorBarProps) {
  return (
    <div
      className={cn(
        "flex gap-[1px] p-[1px] bg-border/20 border border-border/10 select-none pointer-events-none",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
    >
      {CMYK_COLORS.map((cmyk) => (
        <div
          key={cmyk.name}
          className={cn("flex gap-[1px]", orientation === "vertical" ? "flex-col" : "flex-row")}
        >
          {showScales ? (
            SCALES.map((scale) => (
              <div
                key={`${cmyk.name}-${scale}`}
                className={cn(
                  "w-3 h-3 sm:w-4 sm:h-4 transition-opacity",
                  orientation === "vertical" ? "w-3 sm:w-4" : "h-3 sm:h-4"
                )}
                style={{
                  backgroundColor: cmyk.color,
                  opacity: scale === 0 ? 0.05 : scale / 100,
                }}
                title={`${cmyk.label} ${scale}%`}
              />
            ))
          ) : (
            <div
              className={cn("w-4 h-4", orientation === "vertical" ? "w-4 h-8" : "w-8 h-4")}
              style={{ backgroundColor: cmyk.color }}
              title={cmyk.label}
            />
          )}
        </div>
      ))}
    </div>
  )
}
