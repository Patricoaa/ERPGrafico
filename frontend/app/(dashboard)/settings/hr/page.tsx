"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { HRSettingsView } from "@/features/settings/components/HRSettingsView"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { CloudCheck, CloudUpload } from "lucide-react"

export default function HRSettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "global"
    const [saving, setSaving] = useState(false)

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de RRHH"
                description="Gestione parámetros generales comerciales y contables aplicables al módulo de RRHH."
                iconName="settings"
                status={
                    saving 
                        ? { label: "Guardando...", type: "saving" } 
                        : { label: "Sincronizado", type: "synced" }
                }
            />

            <PageTabs
                tabs={[
                    { value: "global", label: "Globales", iconName: "settings", href: "/settings/hr?tab=global" },
                    { value: "concepts", label: "Conceptos", iconName: "list-checks", href: "/settings/hr?tab=concepts" },
                    { value: "previsional", label: "Previsión / AFP", iconName: "building", href: "/settings/hr?tab=previsional" },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-xl"
            />

            <div className="mt-6">
                <HRSettingsView 
                    activeTab={activeTab} 
                    onSavingChange={setSaving}
                />
            </div>
        </div>
    )
}

