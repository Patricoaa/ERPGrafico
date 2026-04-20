import { Metadata } from "next"
import { Suspense, lazy } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { Tabs } from "@/components/ui/tabs"
import { LAYOUT_TOKENS } from "@/lib/styles"

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

    const tabs = [
        { value: "portfolio", label: "Cartera de Crédito", iconName: "pie-chart", href: "/sales/credits?tab=portfolio" },
        { value: "history", label: "Historial de Créditos", iconName: "clock", href: "/sales/credits?tab=history" },
        { value: "blacklist", label: "Lista Negra", iconName: "user-x", href: "/sales/credits?tab=blacklist" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "history":
                return {
                    title: "Historial de Asignaciones",
                    description: "Registro global de créditos asignados a clientes.",
                    iconName: "history",
                    showAction: false
                }
            case "blacklist":
                return {
                    title: "Lista Negra",
                    description: "Clientes con historial de impago o riesgo crediticio.",
                    iconName: "user-x",
                    showAction: false
                }
            case "portfolio":
            default:
                return {
                    title: "Cartera de Créditos",
                    description: "Saldo por cliente, clasificación por antigüedad y estado de cobro.",
                    iconName: "credit-card",
                    showAction: true
                }
        }
    }

    const { title, description, iconName, showAction } = getHeaderConfig()

    const createAction = showAction ? (
        <ToolbarCreateButton
            label="Asignar Crédito"
            href="/sales/credits?tab=portfolio&modal=new"
        />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <Tabs value={activeTab} className="space-y-4">
                <PageHeader
                    title={title}
                    description={description}
                    iconName={iconName}
                />
                <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-md" />

                <div className="pt-4 mt-0 outline-none">
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
