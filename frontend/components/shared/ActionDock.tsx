"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

interface ActionDockProps {
    isVisible: boolean
    children: React.ReactNode
    className?: string
}

/**
 * ActionDock
 * A reusable floating taskbar for bottom-of-page actions, multi-selection summaries,
 * and contextual tools. Automatically adjusts its position when side panels are open.
 */
export function ActionDock({ isVisible, children, className }: ActionDockProps) {
    const { isHubEffectivelyOpen } = useHubPanel()
    const [globalPanelStates, setGlobalPanelStates] = React.useState({ hub: false, inbox: false })

    // Track global panel states via body attributes (standard repo pattern)
    React.useEffect(() => {
        const updateStates = () => {
            setGlobalPanelStates({
                hub: document.body.hasAttribute('data-hub-open'),
                inbox: document.body.hasAttribute('data-inbox-open')
            })
        }
        
        updateStates()
        const observer = new MutationObserver(updateStates)
        observer.observe(document.body, { 
            attributes: true, 
            attributeFilter: ['data-hub-open', 'data-inbox-open'] 
        })
        
        return () => observer.disconnect()
    }, [])

    // Calculate shifting based on open panels to maintain visual centering
    // Each panel is roughly 320-400px. We shift by half the active panels' total width.
    const getPositionClass = () => {
        if (globalPanelStates.inbox && globalPanelStates.hub) return "left-[calc(50%-340px)] -translate-x-1/2"
        if (globalPanelStates.hub) return "left-[calc(50%-180px)] -translate-x-1/2"
        if (globalPanelStates.inbox) return "left-[calc(50%-160px)] -translate-x-1/2"
        return "left-1/2 -translate-x-1/2"
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={cn(
                        "fixed bottom-6 z-[100] bg-card border shadow-elevated rounded-full px-6 py-3 flex items-center gap-8 transition-all duration-500 ease-[var(--ease-premium)]",
                        getPositionClass(),
                        className
                    )}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

ActionDock.Section = function ActionDockSection({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex items-center gap-2", className)}>{children}</div>
}

/**
 * Container for statistical data with an inner shadow and muted background.
 */
ActionDock.Stats = function ActionDockStats({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("flex items-center gap-8 bg-muted/40 px-8 py-2.5 rounded-full border border-border/40 shadow-inner", className)}>
            {children}
        </div>
    )
}

ActionDock.Stat = function ActionDockStat({ 
    label, 
    value, 
    colorClass = "text-foreground" 
}: { 
    label: React.ReactNode, 
    value: React.ReactNode, 
    colorClass?: string 
}) {
    return (
        <div className="flex flex-col border-r border-border/40 pr-8 last:border-0 justify-center">
            <div className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1.5 whitespace-nowrap">{label}</div>
            <div className={cn("text-sm font-mono font-bold leading-none", colorClass)}>
                {value}
            </div>
        </div>
    )
}

/**
 * Container for action buttons, typically placed at the end of the dock.
 */
ActionDock.Actions = function ActionDockActions({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex items-center gap-2 border-l pl-6 py-1", className)}>{children}</div>
}
