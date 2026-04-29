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
     * - 'crop': Professional "open" crop marks projected outward
     */
    variant?: 'corner' | 'crosshair' | 'target' | 'crop'
    /**
     * Render a classic prepress registration mark (circle + crosshair) at each
     * corner, positioned diagonally outside the content boundary.
     * Ideal for the main page layout delimiter in DashboardShell.
     */
    showRegistration?: boolean
    /** Whether to use the active (primary) color instead of the default subtle mark color */
    active?: boolean
    /** Additional className */
    className?: string
}

const MARK_BASE = "absolute pointer-events-none z-[1]"
const MARK_SIZE = "w-3 h-3" // 12px

// ─── Registration Mark SVG ────────────────────────────────────────────────────
// Renders the classic prepress symbol: circle + crosshair, centered on (0,0).
// Size is 20×20 px; the crosshair lines extend to ±10px, circle radius is 7px.
function RegistrationSymbol({ active }: { active: boolean }) {
    const stroke = active ? "var(--mark-color-active)" : "var(--mark-color)"
    return (
        <svg
            width="15"
            height="15"
            viewBox="-10 -10 20 20"
            fill="none"
            aria-hidden="true"
        >
            {/* Outer circle */}
            <circle cx="0" cy="0" r="7.5" stroke={stroke} strokeWidth="1" />
            {/* Horizontal crosshair */}
            <line x1="-10" y1="0" x2="10" y2="0" stroke={stroke} strokeWidth="1" />
            {/* Vertical crosshair */}
            <line x1="0" y1="-10" x2="0" y2="10" stroke={stroke} strokeWidth="1" />
        </svg>
    )
}

// ─── Registration Mark Positioner ─────────────────────────────────────────────
// Places the symbol centered diagonally outside each corner.
// Offset: 13px out from the corner in both axes (sits in the "bleed zone").
function RegistrationMarks({
    positions,
    active,
}: {
    positions: MarkPosition[]
    active: boolean
}) {
    return (
        <>
            {positions.map((pos) => {
                const [vertical, horizontal] = pos.split('-') as ['top' | 'bottom', 'left' | 'right']

                // Position the mark so its CENTER aligns exactly on the corner point,
                // then push it further outward into the bleed space.
                const vClass = vertical === 'top' ? '-top-[10px]' : '-bottom-[10px]'
                const hClass = horizontal === 'left' ? '-left-[10px]' : '-right-[10px]'

                return (
                    <div
                        key={`reg-${pos}`}
                        className={cn(
                            "absolute pointer-events-none z-[2] w-0 h-0",
                            vClass,
                            hClass,
                        )}
                    >
                        {/* Centered via -translate-50% on both axes */}
                        <div className="absolute -translate-x-1/2 -translate-y-1/2">
                            <RegistrationSymbol active={active} />
                        </div>
                    </div>
                )
            })}
        </>
    )
}

/**
 * IndustryMark — Print-Industry Registration & Crop Marks
 *
 * Renders decorative corner marks that evoke the registration/crop marks
 * used in offset printing and graphic production. This component is a key
 * differentiator of the design aesthetic.
 *
 * Use `showRegistration` to add classic prepress registration symbols (⊕)
 * outside the content boundary — ideal for the main page layout delimiter.
 *
 * Usage:
 * ```tsx
 * <div className="relative overflow-visible">
 *   <IndustryMark variant="crop" showRegistration />
 *   {children}
 * </div>
 * ```
 *
 * @contract component-contracts.md §9
 */
export function IndustryMark({
    positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    variant = 'crop',
    showRegistration = false,
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
                            <div className={cn(
                                "absolute left-1/2 top-0 w-[2px] h-full -translate-x-1/2",
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                            <div className={cn(
                                "absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2",
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                        </div>
                    )
                })}
                {showRegistration && <RegistrationMarks positions={positions} active={active} />}
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
                {showRegistration && <RegistrationMarks positions={positions} active={active} />}
            </>
        )
    }

    if (variant === 'crop') {
        return (
            <>
                {positions.map((pos) => {
                    const [vertical, horizontal] = pos.split('-') as ['top' | 'bottom', 'left' | 'right']
                    return (
                        <div
                            key={pos}
                            className={cn(
                                MARK_BASE, "w-[1px] h-[1px]",
                                vertical === 'top' ? 'top-0' : 'bottom-0',
                                horizontal === 'left' ? 'left-0' : 'right-0',
                                className
                            )}
                        >
                            {/* Horizontal tick (Outward) */}
                            <div className={cn(
                                "absolute h-[1px] w-3",
                                vertical === 'top' ? 'top-0' : 'bottom-0',
                                horizontal === 'left' ? '-left-[16px]' : '-right-[16px]',
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                            {/* Vertical tick (Outward) */}
                            <div className={cn(
                                "absolute w-[1px] h-3",
                                vertical === 'top' ? '-top-[16px]' : '-bottom-[16px]',
                                horizontal === 'left' ? 'left-0' : 'right-0',
                                active ? "bg-[var(--mark-color-active)]" : "bg-[var(--mark-color)]"
                            )} />
                        </div>
                    )
                })}
                {/* Registration symbols (⊕) projected into the bleed zone */}
                {showRegistration && <RegistrationMarks positions={positions} active={active} />}
            </>
        )
    }

    // Default: corner marks (L-shaped)
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
            {showRegistration && <RegistrationMarks positions={positions} active={active} />}
        </>
    )
}
