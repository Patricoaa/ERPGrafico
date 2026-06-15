import { Metadata } from "next"
import { CompanySettingsView } from "@/features/settings"

export const metadata: Metadata = {
    title: "Configuración de Empresa | ERPGrafico",
    description: "Gestione la identidad y parámetros globales de su organización.",
}

export default async function CompanySettingsGeneralPage() {
    return <CompanySettingsView activeTab="general" />
}
