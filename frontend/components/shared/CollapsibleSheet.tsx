"use client"

import React, { useEffect, useState } from "react"
import { SheetContent } from "@/components/ui/sheet"
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
    // Detaches the subtree from CSS layout calculations without unmounting React instances (preserves hook form states)
    const [isHidden, setIsHidden] = useState(isCollapsed)

    useEffect(() => {
        let timeout: NodeJS.Timeout
        if (isCollapsed) {
            // Apply display:none after the 500ms slide-out transition ends
            timeout = setTimeout(() => setIsHidden(true), 500)
        } else {
            // Remove display:none immediately to allow slide-in transition
            setIsHidden(false)
        }
        return () => clearTimeout(timeout)
    }, [isCollapsed])
    
    // Vertical stacking for tabs when multiple sheets are hidden
    // Spread them out from top to bottom (e.g. 15%, 33%, 51%)
    // Reduced spacing to allow for up to 5-6 tabs without overflowing
    const verticalOffset = stackIndex === -1 ? "50%" : `${15 + (stackIndex * 18)}%`

    return (
        <SheetContent
            side={side}
            className={cn(
                "p-0 flex flex-col border-l shadow-2xl overflow-visible transition-all duration-500 ease-in-out",
                isCollapsed ? "border-primary/10" : "translate-x-0",
                className
            )}
            hideOverlay={hideOverlay}
            hideCloseButton={true}
            onPointerDownOutside={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            style={{
                transform: isCollapsed ? `translateX(calc(100% - ${offset}px))` : 'translateX(0)',
                willChange: 'transform',
                zIndex: 40 + (isCollapsed ? 0 : 5), // Below action modals (z-50) but above page content
                maxWidth: fullWidth,
                width: fullWidth
            }}
        >
            {/* Vertical Tab (Solapa) - Only visible when collapsed */}
            <div
                onClick={() => isCollapsed && onOpenChange(true)}
                className={cn(
                    "absolute top-0 right-full w-[42px] h-[180px] bg-primary/95 backdrop-blur-md rounded-l-2xl border-l border-y border-primary/20 shadow-[-15px_0_30px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden group",
                    isCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                style={{
                    top: verticalOffset,
                    marginTop: '-90px', // Replaces translateY(-50%) to avoid webkit nested transform compositing bugs
                }}
                role="button"
                tabIndex={isCollapsed ? 0 : -1}
                onKeyDown={(e) => { if (isCollapsed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenChange(true) } }}
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
                isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100",
                isHidden && "hidden" // DOM Pruning: Display none
            )}>
                {children}
            </div>
        </SheetContent>
    )
}
