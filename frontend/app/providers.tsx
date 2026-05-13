'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/react-query'
import { ReactNode, Suspense } from 'react'
import { BrandingProvider } from '@/contexts/BrandingProvider'
import { TableSkeleton } from '@/components/shared'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <Suspense fallback={<TableSkeleton />}>
                    <BrandingProvider>
                        {children}
                    </BrandingProvider>
                </Suspense>
            </QueryClientProvider>
        </NuqsAdapter>
    )
}
