"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react"
import { usePathname } from "next/navigation"

export interface HeaderConfig {
    title: string
    description?: string
    iconName?: string
    titleActions?: React.ReactNode
    isLoading?: boolean
    status?: {
        label: string
        type?: 'synced' | 'saving' | 'error' | 'warning' | 'info'
        iconName?: string
    }
    children?: React.ReactNode
}

interface HeaderContextType {
    config: HeaderConfig | null
    setHeader: (config: HeaderConfig | null) => void
    clearHeader: () => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export function HeaderProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<HeaderConfig | null>(null)
    const pathname = usePathname()

    const setHeader = useCallback((newConfig: HeaderConfig | null) => {
        setConfig(newConfig)
    }, [])

    const clearHeader = useCallback(() => {
        setConfig(null)
    }, [])

    // Clear header when navigating to a different page
    // This prevents the old header from lingering on pages that don't define one
    useEffect(() => {
        clearHeader()
    }, [pathname, clearHeader])

    const value = useMemo(() => ({
        config,
        setHeader,
        clearHeader
    }), [config, setHeader, clearHeader])

    return (
        <HeaderContext.Provider value={value}>
            {children}
        </HeaderContext.Provider>
    )
}

export function useHeader() {
    const context = useContext(HeaderContext)
    if (context === undefined) {
        throw new Error("useHeader must be used within a HeaderProvider")
    }
    return context
}
