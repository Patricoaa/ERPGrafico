"use client"

import { lazy, Suspense, useState } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"

// Lazy load the InventorySettingsView component
const InventorySettingsView = lazy(() =>
    import("@/features/settings/components/InventorySettingsView").then(module => ({
        default: module.InventorySettingsView
    }))
)

export default function InventorySettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "accounts"
    const [saving, setSaving] = useState(false)

    const tabs = [
        { value: "accounts", label: "Cuentas de Inventario", iconName: "package", href: "/settings/inventory?tab=accounts" },
        { value: "adjustments", label: "Ajustes y Valoración", iconName: "trending-up", href: "/settings/inventory?tab=adjustments" },
        { value: "cogs", label: "Costo de Ventas", iconName: "dollar-sign", href: "/settings/inventory?tab=cogs" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de Inventario"
                description="Gestione las cuentas de stock, ajustes y costo de ventas."
                variant="minimal"
                iconName="settings"
                status={
                    saving 
                        ? { label: "Guardando cambios...", type: "saving" } 
                        : { label: "Cambios guardados", type: "synced" }
                }
            />
            
            <div className="pt-2">
                <PageTabs tabs={tabs} activeValue={activeTab} />
            </div>

            <div className="mt-6">
                <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
                    <InventorySettingsView 
                        activeTab={activeTab} 
                        onSavingChange={setSaving} 
                    />
                </Suspense>
            </div>
        </div>
    )
}
