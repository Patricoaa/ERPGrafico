'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/react-query'
import { type ReactNode, Suspense, useEffect } from 'react'
import { BrandingProvider } from '@/contexts/BrandingProvider'
import { SkeletonShell } from '@/components/shared'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ThemeProvider } from 'next-themes'
import { fetchEntityPrefixes, fetchEntityConfig } from '@/lib/api/entity-prefixes'
import { useApplyDensityPreference } from '@/hooks/useDensityPreference'

function EntityConfigInitializer({ children }: { children: ReactNode }) {
    useEffect(() => {
        fetchEntityPrefixes()
        fetchEntityConfig()
    }, [])
    return <>{children}</>
}

export default function Providers({ children }: { children: ReactNode }) {
    // ADR-0142: per-device density preference → <html data-density>
    useApplyDensityPreference()
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                    <Suspense fallback={
                        <SkeletonShell isLoading ariaLabel="Cargando aplicación">
                            <div className="h-full w-full" />
                        </SkeletonShell>
                    }>
                        <BrandingProvider>
                            <EntityConfigInitializer>
                                {children}
                            </EntityConfigInitializer>
                        </BrandingProvider>
                    </Suspense>
                </ThemeProvider>
            </QueryClientProvider>
        </NuqsAdapter>
    )
}