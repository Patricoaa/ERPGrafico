import { Metadata } from "next"
import { Suspense, lazy } from "react"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { Tabs } from "@/components/ui/tabs"
import { redirect } from "next/navigation"
import { FadeIn } from "@/components/shared"
import { CreditPortfolioView, BlacklistView } from "@/features/credits"

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

    if (!resolvedParams.tab) {
        redirect('/sales/credits?tab=portfolio')
    }

    const createAction = activeTab === 'portfolio' ? (
        <ToolbarCreateButton
            label="Asignar Crédito"
            href="/sales/credits?tab=portfolio&modal=new"
        />
    ) : null

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} className="space-y-4 h-full flex flex-col">
                <div className="mt-0 outline-none flex-1 min-h-0">
                    <FadeIn key={activeTab}>
                        {activeTab === 'blacklist' ? (
                            <BlacklistView />
                        ) : (
                            <CreditPortfolioView
                                activeTab={activeTab as 'portfolio' | 'history'}
                                externalOpen={modalOpen}
                                createAction={createAction}
                            />
                        )}
                    </FadeIn>
                </div>
            </Tabs>
        </div>
    )
}
