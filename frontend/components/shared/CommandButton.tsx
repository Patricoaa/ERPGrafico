"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CommandButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof Button>, "children" | "value"> {
    icon: LucideIcon
    /** Tool name: tooltip and the start of the accessible name. */
    name: string
    /** Visible value ("Fecha ↓", "Estado", "3"). Without one only the icon shows. */
    value?: React.ReactNode
    /** Spoken value when `value` is not plain text ("Fecha descendente"). */
    valueLabel?: string
    /** Renders the value as a count badge (Filtros). */
    badge?: boolean
}

/**
 * Collection command button (ADR-0158 §2, collection-toolbar §2): icon + chosen value, never the tool
 * name. The name lives in the tooltip and the accessible name ("Ordenar: Fecha descendente"). A button
 * with a value carries the active border.
 */
export const CommandButton = React.forwardRef<HTMLButtonElement, CommandButtonProps>(function CommandButton(
    { icon: Icon, name, value, valueLabel, badge = false, className, ...props },
    ref,
) {
    const hasValue = value !== undefined && value !== null && value !== ""
    const spoken = hasValue ? `${name}: ${valueLabel ?? (typeof value === "string" || typeof value === "number" ? String(value) : "")}` : name
    return (
        <Button
            ref={ref}
            type="button"
            variant="outline"
            size="sm"
            aria-label={spoken}
            title={name}
            className={cn("gap-1.5 bg-background shadow-none", hasValue ? "border-foreground/70" : "border-border/40 px-2", className)}
            {...props}
        >
            <Icon className="size-4 shrink-0" aria-hidden />
            {hasValue &&
                (badge ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-3xs font-semibold text-primary-foreground tabular-nums">{value}</span>
                ) : (
                    <span className="max-w-40 truncate font-medium">{value}</span>
                ))}
        </Button>
    )
})
