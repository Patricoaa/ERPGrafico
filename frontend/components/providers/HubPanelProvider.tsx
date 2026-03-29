"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react"
import { usePathname } from "next/navigation"

export interface HubConfig {
    orderId?: number | null
    invoiceId?: number | null
    type: 'purchase' | 'sale' | 'obligation'
    posSessionId?: number | null
    onActionSuccess?: () => void
}

interface HubPanelContextType {
    openHub: (config: HubConfig) => void
    closeHub: () => void
    isHubOpen: boolean
    hubConfig: HubConfig | null
}

const HubPanelContext = createContext<HubPanelContextType | undefined>(undefined)

export function HubPanelProvider({ 
    children,
    onHubOpenChange
}: { 
    children: React.ReactNode
    onHubOpenChange?: (isOpen: boolean) => void
}) {
    const pathname = usePathname()
    const [hubConfig, setHubConfig] = useState<HubConfig | null>(null)

    const isHubOpen = hubConfig !== null

    const openHub = useCallback((config: HubConfig) => {
        setHubConfig(config)
        onHubOpenChange?.(true)
    }, [onHubOpenChange])

    const closeHub = useCallback(() => {
        setHubConfig(null)
        onHubOpenChange?.(false)
    }, [onHubOpenChange])

    // Auto-close on route change
    useEffect(() => {
        closeHub()
    }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    const value = useMemo(() => ({
        openHub,
        closeHub,
        isHubOpen,
        hubConfig
    }), [openHub, closeHub, isHubOpen, hubConfig])

    return (
        <HubPanelContext.Provider value={value}>
            {children}
        </HubPanelContext.Provider>
    )
}

export function useHubPanel() {
    const context = useContext(HubPanelContext)
    if (context === undefined) {
        throw new Error("useHubPanel must be used within a HubPanelProvider")
    }
    return context
}
