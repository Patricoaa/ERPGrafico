import { Suspense } from "react"
import { AccountingClosuresView, ClosuresSkeleton } from "@/features/accounting"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ClosuresPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<ClosuresSkeleton />}>
                <AccountingClosuresView externalOpen={modal === 'fy'} />
            </Suspense>
        </div>
    )
}
