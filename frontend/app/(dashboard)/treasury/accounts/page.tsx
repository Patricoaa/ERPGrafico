import { lazy, Suspense } from "react"
import { TableSkeleton, ToolbarCreateButton } from "@/components/shared"

const TreasuryAccountsView = lazy(() =>
    import("@/features/treasury").then(module => ({
        default: module.TreasuryAccountsView
    }))
)

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function AccountsPage({ searchParams }: PageProps) {
    const { tab, modal } = await searchParams
    const activeTab = tab || "accounts"
    const modalOpen = modal === "new"

    const actionMap: Record<string, { label: string; href: string }> = {
        accounts: { label: "Nueva Cuenta", href: "/treasury/accounts?tab=accounts&modal=new" },
        banks: { label: "Nuevo Banco", href: "/treasury/accounts?tab=banks&modal=new" },
        methods: { label: "Nuevo Método", href: "/treasury/accounts?tab=methods&modal=new" },
    }

    const action = actionMap[activeTab]
    const createAction = action ? <ToolbarCreateButton label={action.label} href={action.href} /> : null

    return (
        <div className="pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <TreasuryAccountsView activeTab={activeTab} externalOpen={modalOpen} createAction={createAction} />
            </Suspense>
        </div>
    )
}
