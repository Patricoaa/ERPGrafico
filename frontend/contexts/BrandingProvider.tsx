"use client"

import React, { createContext, useContext, useMemo } from 'react'
import { useCompanySettings, type CompanySettings } from '@/features/settings'
import { resolveMediaUrl } from '@/lib/api'

interface BrandingContextType {
    logo: string | null
    company?: CompanySettings
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export function BrandingProvider({ children }: { children: React.ReactNode }) {
    const { settings } = useCompanySettings()

    const logo = resolveMediaUrl(settings?.logo)

    const value = useMemo(() => ({
        logo,
        company: settings
    }), [logo, settings])

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
