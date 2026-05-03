"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react"
import { usePathname } from "next/navigation"

import { LucideIcon } from "lucide-react"
 
export interface HeaderConfig {
    title: string
    description?: string
    iconName?: string
    icon?: LucideIcon
    titleActions?: React.ReactNode
    isLoading?: boolean
    status?: {
        label: string
        type?: 'synced' | 'saving' | 'error' | 'warning' | 'info'
        iconName?: string
        icon?: LucideIcon
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

    // Header clearing is now handled by PageHeader's cleanup function
    // to avoid race conditions during navigation.

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
