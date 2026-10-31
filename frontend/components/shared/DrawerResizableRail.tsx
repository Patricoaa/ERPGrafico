"use client"

import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"

export interface DrawerResizableRailProps {
    /** Whether this rail sits on the left or right of the workspace */
    side: "left" | "right"
    /** Content shown when the rail is in its expanded state */
    children: ReactNode
    /** Content shown when the rail is in its compact/collapsed state (e.g. icon-only rail) */
    collapsedContent?: ReactNode
    /** Default expanded width in pixels (default: left=256, right=288) */
    defaultWidth?: number
    /** Minimum allowable expanded width in pixels (default: left=200, right=240) */
    minWidth?: number
    /** Maximum allowable expanded width in pixels (default: left=420, right=480) */
    maxWidth?: number
    /** Width in pixels when in compact/collapsed state (default: left=56, right=40) */
    compactWidth?: number
    /** Width threshold below which the rail collapses while dragging (default: left=140, right=150) */
    collapseThreshold?: number
    /** Width threshold above which the rail expands while dragging outward (default: left=180, right=190) */
    expandThreshold?: number
    /** localStorage key to persist width and collapsed state */
    storageKey?: string
    /** Controlled collapsed state */
    collapsed?: boolean
    /** Initial collapsed state when uncontrolled (default: false) */
    defaultCollapsed?: boolean
    /** Callback fired when collapsed state changes */
    onToggleCollapsed?: () => void
    /** Additional class names for the outer container */
    className?: string
    /** Additional class names for the content container */
    contentClassName?: string
    /** Accessible label for the resizable splitter handle */
    ariaLabel?: string
}

export function DrawerResizableRail({
    side,
    children,
    collapsedContent,
    defaultWidth: defaultWidthProp,
    minWidth: minWidthProp,
    maxWidth: maxWidthProp,
    compactWidth: compactWidthProp,
    collapseThreshold: collapseThresholdProp,
    expandThreshold: expandThresholdProp,
    storageKey,
    collapsed: controlledCollapsed,
    defaultCollapsed = false,
    onToggleCollapsed,
    className,
    contentClassName,
    ariaLabel = "Divisor de panel redimensionable",
}: DrawerResizableRailProps) {
    // Defaults by side
    const isLeft = side === "left"
    const defaultWidth = defaultWidthProp ?? (isLeft ? 256 : 288)
    const minWidth = minWidthProp ?? (isLeft ? 200 : 240)
    const maxWidth = maxWidthProp ?? (isLeft ? 420 : 480)
    const compactWidth = compactWidthProp ?? (isLeft ? 56 : 40)
    const collapseThreshold = collapseThresholdProp ?? (isLeft ? 140 : 150)
    const expandThreshold = expandThresholdProp ?? (isLeft ? 180 : 190)

    // Uncontrolled collapsed state (SSR safe)
    const [internalCollapsed, setInternalCollapsed] = useState<boolean>(defaultCollapsed)
    const isControlled = controlledCollapsed !== undefined
    const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed

    // Width state
    const [currentWidth, setCurrentWidth] = useState<number>(defaultWidth)
    const lastExpandedWidthRef = useRef<number>(defaultWidth)

    // Drag interaction states
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [isHovered, setIsHovered] = useState<boolean>(false)

    // Drag tracking refs
    const dragStartXRef = useRef<number>(0)
    const dragStartWidthRef = useRef<number>(0)
    const isDraggingRef = useRef<boolean>(false)

    // Restore preference from localStorage on mount (avoids hydration mismatch)
    useEffect(() => {
        if (!storageKey) return
        try {
            const savedState = window.localStorage.getItem(storageKey)
            if (savedState === "1" && !isControlled) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- restore user preference post-mount
                setInternalCollapsed(true)
            }
            const savedWidthStr = window.localStorage.getItem(`${storageKey}.width`)
            if (savedWidthStr) {
                const parsed = parseInt(savedWidthStr, 10)
                if (!Number.isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
                    lastExpandedWidthRef.current = parsed
                    setCurrentWidth(parsed)
                }
            }
        } catch {
            // Storage unavailable; keep defaults
        }
    }, [storageKey, isControlled, minWidth, maxWidth])

    // Helper to persist to localStorage
    const persistState = useCallback((collapsedNext: boolean, widthNext?: number) => {
        if (!storageKey) return
        try {
            window.localStorage.setItem(storageKey, collapsedNext ? "1" : "0")
            if (typeof widthNext === "number") {
                window.localStorage.setItem(`${storageKey}.width`, String(Math.round(widthNext)))
            }
        } catch {
            // Storage failure ignored
        }
    }, [storageKey])

    // Toggle collapse handler
    const toggleCollapse = useCallback(() => {
        const next = !isCollapsed
        if (!isControlled) {
            setInternalCollapsed(next)
        }
        persistState(next, lastExpandedWidthRef.current)
        onToggleCollapsed?.()
    }, [isCollapsed, isControlled, persistState, onToggleCollapsed])

    // Pointer event handlers for the interactive handle
    const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return // Primary click only
        e.preventDefault()
        e.stopPropagation()

        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
            // Safe fallback if browser doesn't support setPointerCapture
        }

        dragStartXRef.current = e.clientX
        dragStartWidthRef.current = isCollapsed ? compactWidth : currentWidth
        isDraggingRef.current = true
        setIsDragging(true)

        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"
    }, [isCollapsed, compactWidth, currentWidth])

    const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return

        const delta = isLeft
            ? e.clientX - dragStartXRef.current
            : dragStartXRef.current - e.clientX

        const rawWidth = dragStartWidthRef.current + delta

        if (isCollapsed) {
            // Outward drag past expansion threshold recovers expanded state
            if (rawWidth >= expandThreshold) {
                const clamped = Math.max(minWidth, Math.min(maxWidth, rawWidth))
                lastExpandedWidthRef.current = clamped
                setCurrentWidth(clamped)
                if (!isControlled) setInternalCollapsed(false)
                persistState(false, clamped)
                onToggleCollapsed?.()
            }
        } else {
            // Inward drag past collapse threshold collapses to compact
            if (rawWidth <= collapseThreshold) {
                if (!isControlled) setInternalCollapsed(true)
                persistState(true, lastExpandedWidthRef.current)
                onToggleCollapsed?.()
            } else {
                const clamped = Math.max(minWidth, Math.min(maxWidth, rawWidth))
                lastExpandedWidthRef.current = clamped
                setCurrentWidth(clamped)
            }
        }
    }, [
        isLeft,
        isCollapsed,
        expandThreshold,
        collapseThreshold,
        minWidth,
        maxWidth,
        isControlled,
        persistState,
        onToggleCollapsed,
    ])

    const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        setIsDragging(false)

        try {
            e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
            // Safe fallback
        }

        document.body.style.cursor = ""
        document.body.style.userSelect = ""

        persistState(isCollapsed, lastExpandedWidthRef.current)
    }, [isCollapsed, persistState])

    // Double-click on handle toggles collapsed state
    const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        toggleCollapse()
    }, [toggleCollapse])

    // Keyboard support for accessibility
    const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggleCollapse()
            return
        }

        const step = e.shiftKey ? 20 : 10
        if (e.key === "ArrowLeft") {
            e.preventDefault()
            if (isLeft) {
                // Shrink left rail
                const next = currentWidth - step
                if (next <= collapseThreshold) {
                    toggleCollapse()
                } else {
                    const clamped = Math.max(minWidth, next)
                    setCurrentWidth(clamped)
                    lastExpandedWidthRef.current = clamped
                    persistState(false, clamped)
                }
            } else {
                // Grow right rail
                if (isCollapsed) {
                    toggleCollapse()
                } else {
                    const next = Math.min(maxWidth, currentWidth + step)
                    setCurrentWidth(next)
                    lastExpandedWidthRef.current = next
                    persistState(false, next)
                }
            }
        } else if (e.key === "ArrowRight") {
            e.preventDefault()
            if (isLeft) {
                // Grow left rail
                if (isCollapsed) {
                    toggleCollapse()
                } else {
                    const next = Math.min(maxWidth, currentWidth + step)
                    setCurrentWidth(next)
                    lastExpandedWidthRef.current = next
                    persistState(false, next)
                }
            } else {
                // Shrink right rail
                const next = currentWidth - step
                if (next <= collapseThreshold) {
                    toggleCollapse()
                } else {
                    const clamped = Math.max(minWidth, next)
                    setCurrentWidth(clamped)
                    lastExpandedWidthRef.current = clamped
                    persistState(false, clamped)
                }
            }
        }
    }, [
        toggleCollapse,
        isLeft,
        isCollapsed,
        currentWidth,
        collapseThreshold,
        minWidth,
        maxWidth,
        persistState,
    ])

    const activeWidth = isCollapsed ? compactWidth : currentWidth

    return (
        <aside
            data-testid={`drawer-resizable-rail-${side}`}
            data-state={isCollapsed ? "collapsed" : "expanded"}
            data-side={side}
            className={cn(
                "relative flex flex-col h-full shrink-0 min-h-0 bg-card overflow-visible",
                isLeft ? "border-r border-border/60" : "border-l border-border/60",
                isDragging ? "transition-none select-none" : "transition-[width] duration-200 ease-out",
                className
            )}
            style={{ width: `${activeWidth}px` }}
        >
            {/* ── Rail Content: Shows collapsedContent or full children ── */}
            <div
                className={cn(
                    "flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden",
                    contentClassName
                )}
            >
                {isCollapsed && collapsedContent ? collapsedContent : children}
            </div>

            {/* ── Interactive Resize Handle (8px touch area over the border) ── */}
            <div
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={activeWidth}
                aria-valuemin={minWidth}
                aria-valuemax={maxWidth}
                aria-label={ariaLabel}
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={cn(
                    "absolute top-0 bottom-0 w-2 z-20 cursor-col-resize select-none touch-none outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    isLeft ? "-right-1" : "-left-1"
                )}
            >
                {/* Visual vertical highlight line (centered in hit area) */}
                <div
                    aria-hidden="true"
                    className={cn(
                        "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] pointer-events-none transition-colors duration-150",
                        isDragging ? "bg-primary" : isHovered ? "bg-primary/50" : "bg-transparent"
                    )}
                />

                {/* Subtle grip indicator in the vertical center */}
                <div
                    aria-hidden="true"
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-1 h-6 rounded-full pointer-events-none transition-all duration-150",
                        isDragging
                            ? "bg-primary opacity-100 shadow-sm scale-110"
                            : isHovered
                            ? "bg-primary/80 opacity-100"
                            : "opacity-0"
                    )}
                />
            </div>
        </aside>
    )
}
