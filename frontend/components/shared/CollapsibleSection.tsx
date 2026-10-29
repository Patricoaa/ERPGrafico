"use client"

import { type ReactNode } from "react"
import { type LucideIcon, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CollapsibleSectionProps {
  title: string
  icon: LucideIcon
  badge?: ReactNode
  open: boolean
  onOpenChange: (v: boolean) => void
  children: ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  open,
  onOpenChange,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <div className={cn("flex flex-col min-h-0", open ? "flex-1" : "shrink-0")}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex h-10 w-full shrink-0 items-center gap-2 border-b border-border/60 px-4 text-left hover:bg-muted/40 transition-colors"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-2xs font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex-1 truncate">
          {title}
        </span>
        {badge}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className={cn("flex flex-1 flex-col min-h-0 overflow-hidden", className)}>
          {children}
        </div>
      )}
    </div>
  )
}
