import { lazy, Suspense } from "react"
import { FormSkeleton, PageHeader } from "@/components/shared"
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

    return (
        <Suspense fallback={<FormSkeleton fields={6} />}>
            <CompanySettingsView activeTab={activeTab} />
        </Suspense>
    )
}
