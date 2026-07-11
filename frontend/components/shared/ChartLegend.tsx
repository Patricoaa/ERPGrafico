"use client"

import React from "react"

interface ChartLegendItem {
  label: string
  color?: string
}

interface ChartLegendProps {
  items: ChartLegendItem[]
}

export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <div className="flex items-center gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
