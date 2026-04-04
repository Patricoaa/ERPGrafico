'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/react-query'
import { ReactNode, Suspense } from 'react'
import { BrandingProvider } from '@/contexts/BrandingProvider'
import { LoadingFallback } from '@/components/shared/LoadingFallback'

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <Suspense fallback={<LoadingFallback />}>
                <BrandingProvider>
                    {children}
                </BrandingProvider>
            </Suspense>
        </QueryClientProvider>
    )
}
