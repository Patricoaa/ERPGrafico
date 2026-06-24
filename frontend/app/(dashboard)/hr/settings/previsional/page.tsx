import { PageSectionHeader } from "@/components/shared"
import { HRSettingsView } from "@/features/settings"

export default async function HRSettingsPrevisionalPage() {
    return (
        <>
            <PageSectionHeader title="Configuración Previsional" description="Parámetros de AFP, salud y seguridad social" />
            <HRSettingsView activeTab="previsional" />
        </>)
}
