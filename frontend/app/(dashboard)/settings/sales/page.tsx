"use client"

import { lazy, Suspense, useState } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"

// Lazy load the SalesSettingsView component
const SalesSettingsView = lazy(() =>
    import("@/features/settings/components/SalesSettingsView").then(module => ({
        default: module.SalesSettingsView
    }))
)

export default function SalesSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "income"
    const [saving, setSaving] = useState(false)

    const tabs = [
        { value: "config_pos", label: "Configuración POS", iconName: "settings", href: "/settings/sales?tab=config_pos" },
        { value: "credit", label: "Crédito y Cartera", iconName: "wallet", href: "/settings/sales?tab=credit" },
        { value: "income", label: "Cuentas Ingresos", iconName: "trending-up", href: "/settings/sales?tab=income" },
        { value: "terminals", label: "Cuentas Terminal", iconName: "credit-card", href: "/settings/sales?tab=terminals" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de Ventas"
                description="Gestione los parámetros generales de ventas, cuentas contables y comportamiento del POS"
                iconName="settings"
                status={
                    saving 
                        ? { label: "Guardando cambios...", type: "saving" } 
                        : { label: "Cambios guardados", type: "synced" }
                }
            />
            
            <div className="pt-2">
                <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-4xl" />
            </div>

            <div className="mt-6">
                <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
                    <SalesSettingsView 
                        activeTab={activeTab} 
                        onSavingChange={setSaving} 
                    />
                </Suspense>
            </div>
        </div>
    )
}
