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
    isHubTemporarilyHidden: boolean
    setHubTemporarilyHidden: (hidden: boolean) => void
    actionEngineRef: React.RefObject<any>
    triggerAction: (actionId: string) => void
    isDocked: boolean
    setIsDocked: (docked: boolean) => void
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
    const [isHubTemporarilyHidden, setHubTemporarilyHidden] = useState(false)
    const [isDocked, setIsDocked] = useState(false)
    const actionEngineRef = React.useRef<any>(null)

    const triggerAction = useCallback((actionId: string) => {
        if (actionEngineRef.current) {
            actionEngineRef.current.handleActionClick(actionId)
        } else {
            console.warn("[HubPanelProvider] actionEngineRef.current is NULL. cannot trigger action:", actionId)
        }
    }, [])

    const isHubOpen = hubConfig !== null

    const openHub = useCallback((config: HubConfig) => {
        setHubConfig(config)
        setHubTemporarilyHidden(false) // Reset on open
        onHubOpenChange?.(true)
    }, [onHubOpenChange])

    const closeHub = useCallback(() => {
        setHubConfig(null)
        setHubTemporarilyHidden(false) // Reset on close
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
        hubConfig,
        isHubTemporarilyHidden,
        setHubTemporarilyHidden,
        actionEngineRef,
        triggerAction,
        isDocked,
        setIsDocked
    }), [openHub, closeHub, isHubOpen, hubConfig, isHubTemporarilyHidden, triggerAction, isDocked])

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
