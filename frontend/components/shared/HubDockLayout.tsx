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
        <div className={cn("flex w-full flex-1 min-h-0 relative", className)}>
            {/* Main Content Area */}
            <motion.div 
                layout
                className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden relative z-0"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                <div className="h-full transition-all duration-500">
                    {children}
                </div>
            </motion.div>

            {/* Hub Dock - NO BORDER, Seamless integration */}
            <AnimatePresence mode="popLayout">
                {isHubOpen && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 420, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        className="sticky top-0 bg-background z-10 shrink-0 overflow-visible"
                        style={{ height: "100%", minHeight: "100%" }}
                    >
                        <div className="w-[420px] h-full">
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
