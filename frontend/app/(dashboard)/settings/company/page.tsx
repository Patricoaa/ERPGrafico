import { lazy, Suspense } from "react"
import { FormSkeleton, PageHeader } from "@/components/shared"
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
    import("@/features/settings").then(module => ({
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
                iconName: "palette",
            }
        }
        return {
            title: "Configuración de Empresa",
            description: "Gestione la identidad y parámetros globales de su organización.",
            iconName: "building",
        }
    }

    const config = getHeaderConfig()

    const navigation = {
        tabs: [
            { value: "general", label: "General", iconName: "building", href: "/settings/company?tab=general" },
            { value: "branding", label: "Identidad Visual", iconName: "palette", href: "/settings/company?tab=branding" },
        ],
        activeValue: activeTab
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={config.title}
                description={config.description}
                iconName={config.iconName}
                variant="minimal"
                navigation={navigation}
            />
            
            <div className="mt-4">
                <Suspense fallback={<FormSkeleton fields={6} />}>
                    <CompanySettingsView activeTab={activeTab} />
                </Suspense>
            </div>
        </div>
    )
}
