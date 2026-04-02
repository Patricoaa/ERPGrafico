"use client"

import { lazy, Suspense, useState } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"

// Lazy load the BillingSettingsView component
const BillingSettingsView = lazy(() =>
    import("@/features/settings/components/BillingSettingsView").then(module => ({
        default: module.BillingSettingsView
    }))
)

export default function BillingSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "accounts"
    const [saving, setSaving] = useState(false)

    const tabs = [
        { value: "accounts", label: "Cuentas por Cobrar/Pagar", iconName: "users", href: "/settings/billing?tab=accounts" },
        { value: "tax", label: "Impuestos", iconName: "receipt", href: "/settings/billing?tab=tax" },
        { value: "dtes", label: "Documentos Electrónicos", iconName: "file-text", href: "/settings/billing?tab=dtes" },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de Facturación"
                description="Gestione las cuentas de clientes, proveedores y el cumplimiento tributario."
                iconName="settings"
                status={
                    saving 
                        ? { label: "Guardando cambios...", type: "saving" } 
                        : { label: "Cambios guardados", type: "synced" }
                }
            />
            
            <div className="pt-2">
                <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />
            </div>

            <div className="mt-6">
                <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
                    <BillingSettingsView 
                        activeTab={activeTab} 
                        onSavingChange={setSaving} 
                    />
                </Suspense>
            </div>
        </div>
    )
}
