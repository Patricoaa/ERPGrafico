"use client"

import React, { useEffect, useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { LucideIcon } from "lucide-react"

interface CollapsibleSheetProps {
    children: React.ReactNode
    sheetId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    tabLabel: string
    tabIcon: LucideIcon
    className?: string
    side?: "top" | "bottom" | "left" | "right"
    forceCollapse?: boolean
    fullWidth?: number
    hideOverlay?: boolean
}

export function CollapsibleSheet({
    children,
    sheetId,
    open,
    onOpenChange,
    tabLabel,
    tabIcon: Icon,
    className,
    side = "right",
    forceCollapse = false,
    fullWidth = 500,
    hideOverlay = true
}: CollapsibleSheetProps) {
    const { registerSheet, unregisterSheet, getSheetOffset, isSheetCollapsed, getSheetIndex } = useGlobalModals()
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (open) {
            registerSheet(sheetId, fullWidth, forceCollapse)
        } else {
            unregisterSheet(sheetId)
        }
        return () => unregisterSheet(sheetId)
    }, [open, sheetId, fullWidth, forceCollapse, registerSheet, unregisterSheet])

    const isCollapsed = isSheetCollapsed(sheetId)
    const offset = getSheetOffset(sheetId)
    const stackIndex = getSheetIndex(sheetId)
    
    // PERF-07: DOM Pruning Engine
    // Detaches the subtree from CSS layout calculations without unmounting React instances immediately.
    const [isHidden, setIsHidden] = useState(!open && !isCollapsed)
    // Deferred unmount to let 500ms CSS exit transition finish before Radix destroys the DOM Node
    const [shouldMount, setShouldMount] = useState(open || isCollapsed)

    useEffect(() => {
        let hideTimeout: NodeJS.Timeout
        let unmountTimeout: NodeJS.Timeout

        if (open || isCollapsed) {
            setShouldMount(true)
            setIsHidden(false)
        } else {
            // Give 500ms for slide-out before removing from CSS tree and completely unmounting
            hideTimeout = setTimeout(() => setIsHidden(true), 500)
            unmountTimeout = setTimeout(() => setShouldMount(false), 500)
        }

        return () => {
            clearTimeout(hideTimeout)
            clearTimeout(unmountTimeout)
        }
    }, [isCollapsed, open])
    
    // Vertical stacking for tabs when multiple sheets are hidden
    // Spread them out from top to bottom (e.g. 15%, 33%, 51%)
    // Reduced spacing to allow for up to 5-6 tabs without overflowing
    const verticalOffset = stackIndex === -1 ? "50%" : `${15 + (stackIndex * 18)}%`

    // Prevention of initial flash on mount and full pruning
    if (!isMounted || !shouldMount) return null

    return (
        <Sheet open={true} modal={false}>
            <SheetContent
            side={side}
            className={cn(
                "p-0 flex flex-col border-l shadow-2xl overflow-visible transition-all duration-500 ease-in-out",
                // Disable default Radix/Shadcn animations to avoid conflicting with custom high-performance transforms
                "data-[state=open]:animate-none data-[state=closed]:animate-none duration-0 sm:duration-500",
                (!open || isCollapsed) ? "border-primary/10" : "translate-x-0",
                className
            )}
            hideOverlay={hideOverlay}
            hideCloseButton={true}
            onPointerDownOutside={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            style={{
                transform: (!open || isCollapsed) ? `translateX(calc(100% - ${offset}px))` : 'translateX(0)',
                willChange: 'transform',
                zIndex: 40 + (!open || isCollapsed ? 0 : 5), // Below action modals (z-50) but above page content
                maxWidth: fullWidth,
                width: fullWidth,
                // Ensure immediate positioning on mount if closed
                transition: (!open && !isCollapsed) ? 'none' : undefined
            }}
        >
            {/* Vertical Tab (Solapa) - Only visible when collapsed AND open */}
            <div
                onClick={() => isCollapsed && onOpenChange(true)}
                className={cn(
                    "absolute top-0 right-full w-[42px] h-[180px] bg-primary/95 backdrop-blur-md rounded-l-2xl border-l border-y border-primary/20 shadow-[-15px_0_30px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden group",
                    (isCollapsed && open) ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                style={{
                    top: verticalOffset,
                    marginTop: '-90px', // Replaces translateY(-50%) to avoid webkit nested transform compositing bugs
                }}
                role="button"
                tabIndex={isCollapsed && open ? 0 : -1}
                onKeyDown={(e) => { if (isCollapsed && open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenChange(true) } }}
                aria-label={`Expandir panel ${tabLabel}`}
            >
                <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in slide-in-from-right-4 duration-700">
                    <Icon className="h-6 w-6 text-primary-foreground/90 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col items-center whitespace-nowrap">
                        <span className="text-[13px] font-black text-primary-foreground [writing-mode:vertical-rl] rotate-180 tracking-widest leading-none">
                            {tabLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* Standard Wrapper for Content to handle opacity/grayscale */}
            <div className={cn(
                "flex flex-col h-full bg-background transition-opacity duration-300",
                ((!open || isCollapsed) && !forceCollapse) ? "opacity-0 pointer-events-none" : "opacity-100",
                ((isHidden || !open) && !forceCollapse) && "hidden" // DO NOT prune from DOM if forced (modal is likely open)
            )}>
                {children}
            </div>
        </SheetContent>
        </Sheet>
    )
}
