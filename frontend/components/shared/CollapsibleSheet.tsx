"use client"

import React, { useEffect } from "react"
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
    fullWidth = 500
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
    
    // Vertical stacking for tabs when multiple sheets are hidden
    // Spread them out from top to bottom (e.g. 20%, 45%, 70%)
    const verticalOffset = stackIndex === -1 ? "50%" : `${15 + (stackIndex * 24)}%`

    return (
        <SheetContent
            side={side}
            className={cn(
                "p-0 flex flex-col border-l shadow-2xl overflow-visible transition-all duration-500 ease-in-out",
                isCollapsed ? "border-primary/10" : "translate-x-0",
                className
            )}
            style={{
                transform: isCollapsed ? `translateX(calc(100% - ${offset}px))` : 'translateX(0)',
                zIndex: 100 + (isCollapsed ? 0 : 10), // Basic z-index stacking if needed
                maxWidth: fullWidth,
                width: fullWidth
            }}
            // Avoid overlay blocking interaction with foreground modals when collapsed
            onPointerDownOutside={(e) => { if (isCollapsed) e.preventDefault() }}
            onInteractOutside={(e) => { if (isCollapsed) e.preventDefault() }}
        >
            {/* Vertical Tab (Solapa) - Only visible when collapsed */}
            <div
                onClick={() => isCollapsed && onOpenChange(true)}
                className={cn(
                    "absolute left-0 -translate-x-full w-[42px] h-[180px] bg-primary/95 backdrop-blur-md rounded-l-2xl border-l border-y border-primary/20 shadow-[-15px_0_30px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden group",
                    isCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-x-0"
                )}
                style={{
                    top: verticalOffset,
                    transform: 'translateY(-50%)'
                }}
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
                isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                {children}
            </div>
        </SheetContent>
    )
}
