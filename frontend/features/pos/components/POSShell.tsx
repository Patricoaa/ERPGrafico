"use client"

import React from "react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { cn } from "@/lib/utils"

export function POSShell({ children }: { children: React.ReactNode }) {
    const { isHubOpen, isHubTemporarilyHidden } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()

    const isHubEffectivelyOpen = isHubOpen && !isSubModalActive && !isHubTemporarilyHidden

    return (
        <div 
            className={cn(
                "flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out h-full overflow-hidden relative",
                isHubEffectivelyOpen && "md:mr-[500px]"
            )}
        >
            {children}
        </div>
    )
}
