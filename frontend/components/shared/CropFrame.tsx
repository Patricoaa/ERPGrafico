"use client"

/**
 * CropFrame — Hover "Focus" Animation
 *
 * Wraps any interactive element and renders animated crop marks on hover.
 * On hover, L-shaped lines grow OUTWARD from each corner — identical geometry
 * to IndustryMark variant="crop" — ensuring visual consistency across the
 * Industrial Premium design system.
 *
 * Used on square action buttons in the ERPGrafico topbar.
 *
 * @contract component-contracts.md §9 — Industrial Premium interaction
 */

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import React from "react"

interface CropFrameProps {
    children: React.ReactNode
    className?: string
    /** Length of each tick line in px. Default: 6 (variant="default") */
    size?: number
    /** Line thickness in px. Default: 1 */
    thickness?: number
    /**
     * Gap between the button edge and the start of the mark.
     * Default: 2 (variant="default")
     */
    gap?: number
    /** CSS color value. Default: var(--primary) */
    color?: string
    /**
     * Predefined size standard.
     * - "default": size=6, gap=2 (standard button balance)
     * - "compact": size=4, gap=1 (micro-interactions)
     */
    variant?: "default" | "compact"
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
// Each corner has 2 ticks (H + V) that grow OUTWARD from the button edge.
//
//  tl:   ← H-tick (grows left)        tr:  H-tick → (grows right)
//        ↑ V-tick (grows up)               ↑ V-tick (grows up)
//
//  bl:   ← H-tick                     br:  H-tick →
//        ↓ V-tick (grows down)             ↓ V-tick (grows down)
//
// transformOrigin is placed at the CORNER end of the line (closest to button),
// so scale 0→1 makes it grow away from the button.
// ─────────────────────────────────────────────────────────────────────────────

type Corner = "tl" | "tr" | "bl" | "br"
type Dir = "h" | "v"

function getTickStyle(
    corner: Corner,
    dir: Dir,
    size: number,
    thickness: number,
    gap: number
): React.CSSProperties & { transformOrigin: string } {
    const isH = dir === "h"

    if (corner === "tl") {
        return isH
            ? {
                  // Horizontal: left of the top-left corner
                  width: size, height: thickness,
                  top: -gap, left: -(gap + size),
                  transformOrigin: "right center",
              }
            : {
                  // Vertical: above the top-left corner
                  width: thickness, height: size,
                  top: -(gap + size), left: -gap,
                  transformOrigin: "center bottom",
              }
    }
    if (corner === "tr") {
        return isH
            ? {
                  // Horizontal: right of the top-right corner
                  width: size, height: thickness,
                  top: -gap, right: -(gap + size),
                  transformOrigin: "left center",
              }
            : {
                  // Vertical: above the top-right corner
                  width: thickness, height: size,
                  top: -(gap + size), right: -gap,
                  transformOrigin: "center bottom",
              }
    }
    if (corner === "bl") {
        return isH
            ? {
                  // Horizontal: left of the bottom-left corner
                  width: size, height: thickness,
                  bottom: -gap, left: -(gap + size),
                  transformOrigin: "right center",
              }
            : {
                  // Vertical: below the bottom-left corner
                  width: thickness, height: size,
                  bottom: -(gap + size), left: -gap,
                  transformOrigin: "center top",
              }
    }
    // br
    return isH
        ? {
              // Horizontal: right of the bottom-right corner
              width: size, height: thickness,
              bottom: -gap, right: -(gap + size),
              transformOrigin: "left center",
          }
        : {
              // Vertical: below the bottom-right corner
              width: thickness, height: size,
              bottom: -(gap + size), right: -gap,
              transformOrigin: "center top",
          }
}

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"]
const DIRS: Dir[] = ["h", "v"]

export const CropFrame = React.forwardRef<HTMLDivElement, CropFrameProps>(
    ({ 
        children, 
        className, 
        variant = "default",
        size, 
        thickness = 1, 
        gap, 
        color = "var(--primary)" 
    }, ref) => {
        // Apply variant defaults if specific props are missing
        const finalSize = size ?? (variant === "compact" ? 4 : 6)
        const finalGap = gap ?? (variant === "compact" ? 1 : 2)

        return (
            <motion.div
                ref={ref}
            className={cn("relative overflow-visible inline-flex", className)}
            initial="rest"
            whileHover="hover"
            animate="rest"
        >
            {/* 4 corners × 2 directions = 8 animated ticks */}
            {CORNERS.map((corner) =>
                DIRS.map((dir) => {
                    const style = getTickStyle(corner, dir, finalSize, thickness, finalGap)
                    const { transformOrigin, ...posStyle } = style
                    const isH = dir === "h"

                    return (
                        <motion.span
                            key={`${corner}-${dir}`}
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                backgroundColor: color,
                                transformOrigin,
                                pointerEvents: "none",
                                zIndex: 2,
                                ...posStyle,
                            }}
                            variants={{
                                rest: { scale: 0, opacity: 0 },
                                hover: {
                                    scale: 1,
                                    opacity: 1,
                                    transition: {
                                        type: "spring",
                                        stiffness: 420,
                                        damping: 24,
                                        // H ticks appear first, V ticks follow slightly after
                                        delay: isH ? 0 : 0.035,
                                    },
                                },
                            }}
                        />
                    )
                })
            )}

            {children}
        </motion.div>
    )
})
CropFrame.displayName = "CropFrame"
