import { Suspense } from "react"
import { PageContainer, Skeleton } from "@/components/shared"
import { TreasuryHeader } from "./TreasuryHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"

export const generateMetadata = createAutoMetadata("treasury")

function TreasuryFallback() {
    return (
        <div className="space-y-4 p-4">
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
        </div>
    )
}

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <TreasuryHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                <Suspense fallback={<TreasuryFallback />}>
                    {children}
                </Suspense>
            </div>
        </PageContainer>
    )
}
