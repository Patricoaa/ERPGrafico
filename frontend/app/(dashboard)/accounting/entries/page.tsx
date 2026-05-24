import { Suspense } from "react"
import { SkeletonShell, ToolbarCreateButton } from "@/components/shared"
import EntriesClientView from "./EntriesClientView"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function EntriesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = (
        <ToolbarCreateButton 
            label="Nuevo Asiento" 
            href="/accounting/entries?modal=new" 
        />
    )

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                <EntriesClientView externalOpen={modal === 'new'} createAction={createAction} />
            </Suspense>
        </div>
    )
}
