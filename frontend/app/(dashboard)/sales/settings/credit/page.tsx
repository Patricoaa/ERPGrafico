import { PageSectionHeader } from "@/components/shared"
import { SalesSettingsView } from "@/features/settings"

export default async function SalesSettingsCreditPage() {
    return (
        <>
            <PageSectionHeader title="Configuración de Créditos" description="Parámetros de evaluación y gestión crediticia" />
            <SalesSettingsView activeTab="credit" />
        </>)
}
