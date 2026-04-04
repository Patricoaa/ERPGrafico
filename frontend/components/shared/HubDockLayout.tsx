"use client"

import React, { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"
import { cn } from "@/lib/utils"

interface HubDockLayoutProps {
    children: React.ReactNode
    className?: string
}

export function HubDockLayout({ children, className }: HubDockLayoutProps) {
    const { isHubOpen, hubConfig, closeHub, setIsDocked } = useHubPanel()

    // Register this layout as a "docked" context
    useEffect(() => {
        setIsDocked(true)
        return () => setIsDocked(false)
    }, [setIsDocked])

    return (
        <div className={cn("flex h-full w-full overflow-hidden relative bg-background", className)}>
            {/* Main Content Area */}
            <motion.div 
                layout
                className="flex-1 min-w-0 h-full overflow-auto"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {children}
            </motion.div>

            {/* Hub Dock */}
            <AnimatePresence mode="popLayout">
                {isHubOpen && (
                    <motion.div
                        initial={{ x: 500, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 500, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-[500px] h-full border-l bg-background shadow-xl z-10 shrink-0"
                    >
                        {hubConfig && (
                            <OrderHubPanel
                                orderId={hubConfig.orderId}
                                invoiceId={hubConfig.invoiceId}
                                type={hubConfig.type}
                                onClose={closeHub}
                                onActionSuccess={hubConfig.onActionSuccess}
                                posSessionId={hubConfig.posSessionId}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
