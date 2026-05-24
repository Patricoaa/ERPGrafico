import { lazy, Suspense } from "react"
import { SkeletonShell } from "@/components/shared"

const AccountingSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.AccountingSettingsView })))

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AccountingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "structure"

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                <AccountingSettingsView activeTab={activeTab} />
            </Suspense>
        </div>
    )
}
