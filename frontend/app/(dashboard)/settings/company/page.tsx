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

export default async function CompanySettingsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeTab = params.tab || "general"

    const getHeaderConfig = () => {
        if (activeTab === 'branding') {
            return {
                title: "Identidad Visual",
                description: "Logotipos, colores corporativos y apariencia de documentos.",
                iconName: "palette" as any
            }
        }
        return {
            title: "Configuración de Empresa",
            description: "Gestione la identidad y parámetros globales de su organización.",
            iconName: "building" as any
        }
    }

    const config = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.iconName}
            />
            
            <div className="pt-4">
                <PageTabs
                    tabs={[
                        { value: "general", label: "General", iconName: "building", href: "/settings/company?tab=general" },
                        { value: "branding", label: "Identidad Visual", iconName: "palette", href: "/settings/company?tab=branding" },
                    ]}
                    activeValue={activeTab}
                />
            </div>

            <div className="mt-4">
                <Suspense fallback={<LoadingFallback message="Cargando configuración..." />}>
                    <CompanySettingsView activeTab={activeTab} />
                </Suspense>
            </div>
        </div>
    )
}
