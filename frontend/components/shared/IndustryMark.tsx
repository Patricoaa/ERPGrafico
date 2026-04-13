"use client"

import React from "react"
import { cn } from "@/lib/utils"

type MarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface IndustryMarkProps {
    /** Which corners to decorate. Defaults to all four. */
    positions?: MarkPosition[]
    /** Visual variant:
     * - 'corner': L-shaped crop marks (default, most common)
     * - 'crosshair': Full crosshair registration marks
     * - 'target': Circular target marks
     */
    variant?: 'corner' | 'crosshair' | 'target'
    /** Whether to use the active (primary) color instead of the default subtle mark color */
    active?: boolean
    /** Additional className */
    className?: string
}

const MARK_BASE = "absolute pointer-events-none z-[1]"
const MARK_SIZE = "w-3 h-3" // 12px

/**
 * IndustryMark — Print-Industry Registration Marks
 * 
 * Renders decorative corner marks that evoke the registration/crop marks
 * used in offset printing and graphic production. This component is a key
 * differentiator of the "Industrial Premium" aesthetic.
 * 
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <IndustryMark />
 *   {children}
 * </div>
 * ```
 * 
 * @contract component-contracts.md §9
 */
export function IndustryMark({
    positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    variant = 'corner',
    active = false,
    className,
}: IndustryMarkProps) {
    const color = active
        ? "border-[var(--mark-color-active)]"
        : "border-[var(--mark-color)]"

    if (variant === 'crosshair') {
        return (
            <>
                {positions.map((pos) => {
                    const [vertical, horizontal] = pos.split('-') as ['top' | 'bottom', 'left' | 'right']
                    return (
                        <div
                            key={pos}
                            className={cn(
                                MARK_BASE, "w-4 h-4",
                                vertical === 'top' ? 'top-2' : 'bottom-2',
                                horizontal === 'left' ? 'left-2' : 'right-2',
                                className
                            )}
                        >
                            {/* Vertical line */}
                            <div className={cn(
                                "absolute left-1/2 top-0 w-[2px] h-full -translate-x-1/2",
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                            {/* Horizontal line */}
                            <div className={cn(
                                "absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2",
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                        </div>
                    )
                })}
            </>
        )
    }

    if (variant === 'target') {
        return (
            <>
                {positions.map((pos) => {
                    const [vertical, horizontal] = pos.split('-') as ['top' | 'bottom', 'left' | 'right']
                    return (
                        <div
                            key={pos}
                            className={cn(
                                MARK_BASE, "w-3 h-3 rounded-full border",
                                color,
                                vertical === 'top' ? 'top-2' : 'bottom-2',
                                horizontal === 'left' ? 'left-2' : 'right-2',
                                className
                            )}
                        >
                            <div className={cn(
                                "absolute inset-[3px] rounded-full",
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                        </div>
                    )
                })}
            </>
        )
    }

    // Default: corner marks (L-shaped crop marks)
    return (
        <>
            {positions.map((pos) => {
                const borders = {
                    'top-left': 'border-t border-l top-2 left-2',
                    'top-right': 'border-t border-r top-2 right-2',
                    'bottom-left': 'border-b border-l bottom-2 left-2',
                    'bottom-right': 'border-b border-r bottom-2 right-2',
                }
                return (
                    <div
                        key={pos}
                        className={cn(
                            MARK_BASE,
                            MARK_SIZE,
                            "border-2",
                            color,
                            borders[pos],
                            className
                        )}
                    />
                )
            })}
        </>
    )
}
