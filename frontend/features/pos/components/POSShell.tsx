"use client"

import React from "react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { cn } from "@/lib/utils"

export function POSShell({ children }: { children: React.ReactNode }) {
    const { isHubOpen, isHubTemporarilyHidden, isDocked, isHubEffectivelyOpen: isHubGlobalVisible } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()

    // The shell should only repel if the Hub is open globally (fixed), 
    // NOT when it's docked inside a sub-view (like the Sales Notes sheet).
    const isHubEffectivelyOpen = isHubGlobalVisible && !isSubModalActive

    // Sync global data attributes for repulsion system
    React.useEffect(() => {
        if (isHubEffectivelyOpen) {
            document.body.setAttribute('data-hub-open', 'true')
        } else {
            document.body.removeAttribute('data-hub-open')
        }
        return () => document.body.removeAttribute('data-hub-open')
    }, [isHubEffectivelyOpen])

    return (
        <div 
            className={cn(
                "flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out h-full overflow-hidden relative",
                isHubEffectivelyOpen && "md:mr-[380px]"
            )}
        >
            {children}
        </div>
    )
}
