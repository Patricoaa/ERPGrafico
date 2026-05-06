import { lazy, Suspense } from "react"
import { TableSkeleton } from "@/components/shared"
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
        <div className="pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <AccountsView externalOpen={modal === 'new'} createAction={createAction} />
            </Suspense>
        </div>
    )
}
