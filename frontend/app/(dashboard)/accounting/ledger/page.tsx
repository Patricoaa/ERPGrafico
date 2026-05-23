import { lazy, Suspense } from "react"
import { SkeletonShell, SimpleTable } from "@/components/shared"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

const AccountsView = lazy(() => import("@/features/accounting").then(m => ({ default: m.AccountsClientView })))

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function LedgerPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = (
        <ToolbarCreateButton 
            label="Nueva Cuenta" 
            href="/accounting/ledger?modal=new" 
        />
    )

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..."><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
                <AccountsView externalOpen={modal === 'new'} createAction={createAction} />
            </Suspense>
        </div>
    )
}
