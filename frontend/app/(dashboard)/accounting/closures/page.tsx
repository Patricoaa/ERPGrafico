import { lazy, Suspense } from "react"
import { TableSkeleton, PageHeaderButton } from "@/components/shared"

const ClosuresView = lazy(() => import("@/features/accounting").then(m => ({ default: m.AccountingClosuresView })))

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ClosuresPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const titleAction = (
        <PageHeaderButton 
            href="/accounting/closures?modal=fy" 
            iconName="plus" 
            circular 
            title="Nuevo Año Fiscal" 
        />
    )

    return (
        <div className="pt-2">
            {/* Note: In the new pattern, titleAction might need to be rendered differently 
                if we want it in the shared header. For now, we render the view. */}
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <ClosuresView externalOpen={modal === 'fy'} />
            </Suspense>
        </div>
    )
}
