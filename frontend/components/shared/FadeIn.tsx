"use client"

import React from "react"
import { cn } from "@/lib/utils"

export interface FadeInProps {
    children: React.ReactNode
    className?: string
    delay?: number
    duration?: number
    yOffset?: number
}

/**
 * FadeIn — the only motion primitive for entry animation (component-animation.md).
 *
 * Wraps its children in a block that fades in and rises `yOffset` px. Use it for sub-views
 * that change without a pathname change (tabs, wizard steps). When the animated element
 * cannot be wrapped (a tooltip, a conditional class, a portal), use `fadeInClass()`
 * (`fade-in-class.ts`): same recipe, applied to the element's own className.
 */
export function FadeIn({
    children,
    className,
    delay = 0,
    duration = 0.35,
    yOffset = 8,
}: FadeInProps) {
    return (
        <div
            className={cn(
                "w-full flex-1 flex flex-col min-h-0 animate-in fade-in ease-premium fill-mode-both motion-reduce:animate-none motion-reduce:opacity-100",
                className
            )}
            style={{
                animationDuration: `${duration}s`,
                animationDelay: delay ? `${delay}s` : undefined,
                "--tw-enter-translate-y": `${yOffset}px`,
            } as React.CSSProperties}
        >
            {children}
        </div>
    )
}
