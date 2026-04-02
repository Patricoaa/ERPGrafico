import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Configuración de Empresa | ERPGrafico",
    description: "Gestione la identidad y parámetros globales de su organización.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

// Lazy load the CompanySettingsView component
const CompanySettingsView = lazy(() =>
    import("@/features/settings/components/CompanySettingsView").then(module => ({
        default: module.CompanySettingsView
    }))
)

export default function CompanySettingsPage() {
    const searchParams = useSearchParams()
    const activeTab = searchParams.get("tab") || "general"
    const [saving, setSaving] = useState(false)

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Configuración de Empresa"
                description="Gestione la identidad y parámetros globales de su organización"
                iconName="building"
                status={
                    saving 
                        ? { label: "Guardando cambios...", type: "saving" } 
                        : { label: "Cambios guardados", type: "synced" }
                }
            />
            
            <div className="pt-2">
                <PageTabs
                    tabs={[
                        { value: "general", label: "General", iconName: "building", href: "/settings/company?tab=general" },
                        { value: "branding", label: "Identidad Visual", iconName: "palette", href: "/settings/company?tab=branding" },
                    ]}
                    activeValue={activeTab}
                />
            </div>

            <div className="mt-6">
                <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
                    <CompanySettingsView 
                        activeTab={activeTab} 
                        onSavingChange={setSaving}
                    />
                </Suspense>
            </div>
        </div>
    )
}
