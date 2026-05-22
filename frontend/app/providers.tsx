'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/react-query'
import { ReactNode, Suspense } from 'react'
import { BrandingProvider } from '@/contexts/BrandingProvider'
import { SkeletonShell } from '@/components/shared/SkeletonShell'
import { SimpleTable } from '@/components/shared/SimpleTable'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ThemeProvider } from 'next-themes'

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                    <Suspense fallback={
                        <SkeletonShell isLoading ariaLabel="Cargando aplicación">
                            <SimpleTable rows={3} columns={1} className="h-full w-full" />
                        </SkeletonShell>
                    }>
                        <BrandingProvider>
                            {children}
                        </BrandingProvider>
                    </Suspense>
                </ThemeProvider>
            </QueryClientProvider>
        </NuqsAdapter>
    )
}