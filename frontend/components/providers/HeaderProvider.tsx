"use client"

import React, { createContext, useContext, useState, useCallback, useMemo } from "react"

import { type LucideIcon } from "lucide-react"
 
export interface SubTabConfig {
    value: string
    label: string
    href: string
    iconName?: string
    permission?: string
    subTabs?: SubTabConfig[]
}

export interface NavigationTabConfig {
    value: string
    label: string
    iconName?: string
    href: string
    permission?: string
    subTabs?: SubTabConfig[]
}

export interface NavigationConfig {
    /** Optional module name to display at the root of the breadcrumbs */
    moduleName?: string
    /** Optional href for the module name */
    moduleHref?: string
    tabs: NavigationTabConfig[]
    activeValue: string
    subActiveValue?: string
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

/** Navegación del módulo + segmento raíz de la ruta donde se publicó. */
export interface ModuleNavigation {
    moduleId: string
    navigation: NavigationConfig
}

interface HeaderContextType {
    config: HeaderConfig | null
    /**
     * Última navegación de módulo publicada. A diferencia de `config`, NO se limpia en
     * `clearHeader`: una vista que monta su propio PageHeader sin `navigation`
     * (p. ej. solo para titleActions) no vacía el sidebar (ADR-0079).
     */
    moduleNavigation: ModuleNavigation | null
    setHeader: (config: HeaderConfig | null) => void
    clearHeader: () => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export function HeaderProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<HeaderConfig | null>(null)
    const [moduleNavigation, setModuleNavigation] = useState<ModuleNavigation | null>(null)

    const setHeader = useCallback((newConfig: HeaderConfig | null) => {
        setConfig(newConfig)
        const navigation = newConfig?.navigation
        if (navigation) {
            // setHeader corre en efectos (cliente, tras el commit de la navegación)
            const moduleId = window.location.pathname.split('/').filter(Boolean)[0] || 'dashboard'
            setModuleNavigation({ moduleId, navigation })
        }
    }, [])

    const clearHeader = useCallback(() => {
        setConfig(null)
    }, [])

    // Header clearing is now handled by PageHeader's cleanup function
    // to avoid race conditions during navigation.

    const value = useMemo(() => ({
        config,
        moduleNavigation,
        setHeader,
        clearHeader
    }), [config, moduleNavigation, setHeader, clearHeader])

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
