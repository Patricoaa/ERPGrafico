"use client"

import { lazy, Suspense, useState, useMemo, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams, useRouter } from "next/navigation"
import { PartnerAccountingTab } from "@/features/settings/components/partners/PartnerAccountingTab"
import Link from "next/link"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

// Lazy load the PartnersSettingsView component
const PartnersSettingsView = lazy(() =>
    import("@/features/settings").then(module => ({
        default: module.PartnersSettingsView
    }))
)

export default function PartnersSettingsPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = searchParams.get("tab") || "composition"
    const isNewDistributionModal = searchParams.get("modal") === "new-distribution"
    const isMobilizeModal = searchParams.get("modal") === "mobilize-earnings"
    const isAddPartnerModal = searchParams.get("modal") === "add-partner"
    const isStatsModal = searchParams.get("modal") === "stats"
    const [saving, setSaving] = useState(false)
    const [configSaving, setConfigSaving] = useState(false)

    // Callback to clear modal param from URL (lifted from ProfitDistributionsTab)
    const handleModalClose = useCallback(() => {
        const currentModal = searchParams.get("modal")
        if (currentModal === "new-distribution" || currentModal === "mobilize-earnings" || currentModal === "add-partner" || currentModal === "stats") {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
    }, [searchParams, router])
    
    // Track previous state to trigger toast on completion
    const prevSaving = useRef(false)
    const prevConfigSaving = useRef(false)

    useEffect(() => {
        if (prevSaving.current && !saving) {
            toast.success("Cambios sincronizados", {
                description: "La configuración de socios ha sido actualizada."
            })
        }
        prevSaving.current = saving
    }, [saving])

    useEffect(() => {
        if (prevConfigSaving.current && !configSaving) {
            toast.success("Arquitectura contable actualizada", {
                description: "Los cambios en las cuentas maestras se han guardado."
            })
        }
        prevConfigSaving.current = configSaving
    }, [configSaving])

    const tabs = [
// ...
        { 
            value: "composition", 
            label: "Composición", 
            iconName: "users", 
            href: "/settings/partners?tab=composition" 
        },
        { 
            value: "distributions", 
            label: "Utilidades", 
            iconName: "pie-chart", 
            href: "/settings/partners?tab=distributions" 
        },
        { 
            value: "config", 
            label: "Config", 
            iconName: "settings", 
            href: "/settings/partners?tab=config" 
        },
    ]

    const headerConfig = useMemo(() => {
        switch (activeTab) {
            case "config":
                return {
                    title: "Arquitectura Contable de Socios",
                    description: "Configure las cuentas maestras para el Modelo Híbrido de Capital.",
                    iconName: "settings" as const,
                    showAction: false,
                    showStats: false
                }
            case "composition":
                return {
                    title: "Composición Societaria",
                    description: "Gestión de capital suscrito y pagado por los socios.",
                    iconName: "users" as const,
                    showAction: true,
                    actionTitle: "Añadir Socio",
                    actionHref: "/settings/partners?tab=composition&modal=add-partner",
                    showStats: true
                }
            case "distributions":
                return {
                    title: "Distribución de Utilidades",
                    description: "Gestión de actas, resolución de dividendos y reinversiones.",
                    iconName: "pie-chart" as const,
                    showAction: true,
                    actionTitle: "Nueva Distribución",
                    actionHref: "/settings/partners?tab=distributions&modal=new-distribution",
                    showStats: false
                }
            default:
                return {
                    title: "Socios y Capital",
                    description: "Gestión societaria y patrimonial.",
                    iconName: "building-2" as const,
                    showAction: false,
                    showStats: false
                }
        }
    }, [activeTab])

    const createAction = headerConfig.showAction && 'actionHref' in headerConfig && headerConfig.actionHref ? (
        <ToolbarCreateButton
            label={('actionTitle' in headerConfig && headerConfig.actionTitle) || "Crear"}
            href={headerConfig.actionHref}
        />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={headerConfig.title}
                description={headerConfig.description}
                iconName={headerConfig.iconName}
                variant="minimal"
            >
                {headerConfig.showStats && (
                    <Link href="/settings/partners?tab=composition&modal=stats">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-transparent hover:bg-muted/50 text-muted-foreground/70 hover:text-foreground">
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                    </Link>
                )}
            </PageHeader>

            <PageTabs tabs={tabs} activeValue={activeTab} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback message="Cargando configuración de socios..." />}>
                    {(activeTab === 'composition' || activeTab === 'distributions') && (
                        <PartnersSettingsView
                            activeTab={activeTab}
                            onSavingChange={setSaving}
                            initialFlowOpen={isNewDistributionModal}
                            initialAddPartnerOpen={isAddPartnerModal}
                            initialStatsOpen={isStatsModal}
                            onModalClose={handleModalClose}
                            createAction={createAction}
                        />
                    )}
                    {activeTab === 'config' && (
                        <div className="p-1">
                            <PartnerAccountingTab onSavingChange={setConfigSaving} />
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    )
}
