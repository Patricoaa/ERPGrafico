"use client"

import React, { createContext, useContext, useMemo } from 'react'
import { useCompanyBranding, type CompanyBranding } from '@/features/settings'
import { resolveMediaUrl } from '@/lib/media-url'

interface BrandingContextType {
    logo: string | null
    company?: CompanyBranding
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export function BrandingProvider({ children }: { children: React.ReactNode }) {
    const { branding } = useCompanyBranding()

    const logo = resolveMediaUrl(branding?.logo)

    const value = useMemo(() => ({
        logo,
        company: branding
    }), [logo, branding])

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
