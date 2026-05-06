"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react"
import { usePathname } from "next/navigation"

import { LucideIcon } from "lucide-react"
 
export interface NavigationTabConfig {
    value: string
    label: string
    iconName?: string
    href: string
    subTabs?: { value: string; label: string; href: string; iconName?: string }[]
}

export interface NavigationConfig {
    /** Optional module name to display at the root of the breadcrumbs */
    moduleName?: string
    /** Optional href for the module name */
    moduleHref?: string
    tabs: NavigationTabConfig[]
    activeValue: string
    subActiveValue?: string
    /** Separate href for config/settings gear icon (excluded from main dropdown) */
    configHref?: string
    /** Optional deep breadcrumbs added after the dropdowns */
    breadcrumbs?: { label: string; href?: string }[]
}

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
    navigation?: NavigationConfig
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
