import { Metadata } from "next"
import { Suspense, lazy } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { Tabs } from "@/components/ui/tabs"

const CreditPortfolioView = lazy(() =>
    import("@/features/credits").then(m => ({ default: m.CreditPortfolioView }))
)

const BlacklistView = lazy(() =>
    import("@/features/credits").then(m => ({ default: m.BlacklistView }))
)

export const metadata: Metadata = {
    title: "Cartera de Créditos | ERPGrafico",
    description: "Gestión de cartera crediticia, clasificación de deuda por antigüedad y control de deudores.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function CreditsPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    const activeTab = resolvedParams.tab || "portfolio"
    const modalOpen = resolvedParams.modal === "new"

    const createAction = activeTab === 'portfolio' ? (
        <ToolbarCreateButton
            label="Asignar Crédito"
            href="/sales/credits?tab=portfolio&modal=new"
        />
    ) : null

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <div className="mt-0 outline-none">
                    <Suspense fallback={<LoadingFallback />}>
                        {activeTab === 'blacklist' ? (
                            <BlacklistView />
                        ) : (
                            <CreditPortfolioView
                                activeTab={activeTab as 'portfolio' | 'history'}
                                externalOpen={modalOpen}
                                createAction={createAction}
                            />
                        )}
                    </Suspense>
                </div>
            </Tabs>
        </div>
    )
}
