"use client"

import { lazy, Suspense, useState, useMemo, useEffect, useRef } from "react"
import { toast } from "sonner"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { PartnerAccountingTab } from "@/features/settings/components/partners/PartnerAccountingTab"
import Link from "next/link"
import { Plus } from "lucide-react"

// Lazy load the PartnersSettingsView component
const PartnersSettingsView = lazy(() =>
    import("@/features/settings").then(module => ({
        default: module.PartnersSettingsView
    }))
)

export default function PartnersSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "composition"
    const [saving, setSaving] = useState(false)
    const [configSaving, setConfigSaving] = useState(false)
    
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
            value: "ledger", 
            label: "Libro Auxiliar", 
            iconName: "book-open", 
            href: "/settings/partners?tab=ledger" 
        },
        { 
            value: "distributions", 
            label: "Utilidades", 
            iconName: "pie-chart", 
            href: "/settings/partners?tab=distributions" 
        }
    ]

    const headerConfig = useMemo(() => {
        switch (activeTab) {
            case "composition":
                return {
                    title: "Composición Societaria",
                    description: "Gestión de capital suscrito y pagado por los socios.",
                    iconName: "users" as const,
                    showAction: false
                }
            case "ledger":
                return {
                    title: "Libro Auxiliar de Socios",
                    description: "Historial detallado de aportes, retiros y movimientos de capital.",
                    iconName: "book-open" as const,
                    showAction: false
                }
            case "distributions":
                return {
                    title: "Distribución de Utilidades",
                    description: "Gestión de actas, resolución de dividendos y reinversiones.",
                    iconName: "pie-chart" as const,
                    showAction: true,
                    actionTitle: "Nueva Distribución",
                    actionHref: "/settings/partners?tab=distributions&modal=new-distribution"
                }
            default:
                return {
                    title: "Socios y Capital",
                    description: "Gestión societaria y patrimonial.",
                    iconName: "building-2" as const,
                    showAction: false
                }
        }
    }, [activeTab])

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={headerConfig.title}
                description={headerConfig.description}
                iconName={headerConfig.iconName}
                variant="minimal"
                configHref="?config=true"
                titleActions={headerConfig.showAction && headerConfig.actionHref && (
                    <Link href={headerConfig.actionHref}>
                        <PageHeaderButton
                            iconName="plus"
                            circular
                            title={headerConfig.actionTitle}
                        />
                    </Link>
                )}
            />

            <PageTabs tabs={tabs} activeValue={activeTab} />

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback message="Cargando configuración de socios..." />}>
                    <PartnersSettingsView 
                        activeTab={activeTab} 
                        onSavingChange={setSaving}
                    />
                </Suspense>
            </div>

            <SettingsSheetRouteWrapper
                sheetId="partner-accounting-settings"
                title="Arquitectura Contable de Socios"
                description="Configure las cuentas maestras para el Modelo Híbrido de Capital."
                tabLabel="Configuración"
            >
                <div className="p-1">
                    <PartnerAccountingTab onSavingChange={setConfigSaving} />
                </div>
            </SettingsSheetRouteWrapper>
        </div>
    )
}
