"use client"

import * as React from "react"
import { SlidersHorizontal } from "lucide-react"
import { CommandButton } from "@/components/shared"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface SettingsMenuProps {
    /** Active changes (filters, sort, group, columns and layout) shown as a badge. */
    count: number
    /** The collection toolbar commits any pending filter draft when the popover closes. */
    onClose: () => void
    /** Escape discards the unapplied filter draft. */
    onEscape: () => void
    children: React.ReactNode
}

/**
 * Narrow-screen replacement for the four command buttons (ADR-0158 §2): one popover with a badge
 * and all the bodies inside, so no popover is nested inside another one.
 */
export function SettingsMenu({ count, onClose, onEscape, children }: SettingsMenuProps) {
    const [open, setOpen] = React.useState(false)
    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose()
                setOpen(next)
            }}
        >
            <PopoverTrigger asChild>
                <CommandButton
                    icon={SlidersHorizontal}
                    name="Ajustes"
                    value={count > 0 ? count : undefined}
                    valueLabel={`${count} ${count === 1 ? "cambio" : "cambios"}`}
                    badge
                    aria-expanded={open}
                />
            </PopoverTrigger>
            <PopoverContent align="start" className="flex max-h-[min(80vh,36rem)] w-[min(92vw,30rem)] flex-col gap-2 overflow-y-auto p-2" onEscapeKeyDown={onEscape}>
                {children}
            </PopoverContent>
        </Popover>
    )
}
