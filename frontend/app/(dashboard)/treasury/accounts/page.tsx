import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"

const TreasuryAccountsView = lazy(() =>
    import("@/features/treasury").then(module => ({
        default: module.TreasuryAccountsView
    }))
)

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AccountsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "accounts"

    return (
        <Suspense fallback={<LoadingFallback message="Cargando cuentas..." />}>
            <TreasuryAccountsView activeTab={activeTab} />
        </Suspense>
    )
}

