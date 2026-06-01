import { Metadata } from "next"
import { CompanySettingsView } from "@/features/settings"

export const metadata: Metadata = {
    title: "Configuración de Empresa | ERPGrafico",
    description: "Gestione la identidad y parámetros globales de su organización.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function CompanySettingsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeTab = params.tab || "general"

    return (
        <CompanySettingsView activeTab={activeTab} />
    )
}
