import { lazy, Suspense } from "react"
import { TableSkeleton, ToolbarCreateButton } from "@/components/shared"

const TaxDeclarationsView = lazy(() => import("@/features/tax").then(m => ({ default: m.TaxDeclarationsView })))

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function TaxPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = (
        <ToolbarCreateButton 
            label="Nueva Declaración" 
            href="/accounting/tax?modal=new" 
        />
    )

    return (
        <div className="pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <TaxDeclarationsView externalOpen={modal === 'new'} createAction={createAction} />
            </Suspense>
        </div>
    )
}
