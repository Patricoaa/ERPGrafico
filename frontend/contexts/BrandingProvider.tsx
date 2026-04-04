"use client"

import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { useCompanySettings } from '@/features/settings'

interface BrandingContextType {
    primaryColor: string
    secondaryColor: string
    logo: string | null
    company?: any
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export function BrandingProvider({ children }: { children: React.ReactNode }) {
    const { settings } = useCompanySettings()

    const primaryColor = settings?.primary_color || '#0f172a'
    const secondaryColor = settings?.secondary_color || '#3b82f6'
    const logo = settings?.logo || null

    useEffect(() => {
        if (typeof window === 'undefined') return
        
        const root = document.documentElement
        
        // Helper to convert hex to OKLCH or just use hex if the system supports it
        // Since the current globals.css uses oklch, but Tailwind 4/Modern CSS 
        // handles hex fine in variables, we'll inject them as standard CSS variables.
        
        root.style.setProperty('--primary', primaryColor)
        root.style.setProperty('--secondary', secondaryColor)
        
        // Optional: Invert colors or adjust contrast if needed, but for now 
        // we'll follow the user request of direct replacement.
        
    }, [primaryColor, secondaryColor])

    const value = useMemo(() => ({
        primaryColor,
        secondaryColor,
        logo,
        company: settings
    }), [primaryColor, secondaryColor, logo, settings])

    return (
        <BrandingContext.Provider value={value}>
            {children}
        </BrandingContext.Provider>
    )
}

export const useBranding = () => {
    const context = useContext(BrandingContext)
    if (context === undefined) {
        throw new Error('useBranding must be used within a BrandingProvider')
    }
    return context
}
