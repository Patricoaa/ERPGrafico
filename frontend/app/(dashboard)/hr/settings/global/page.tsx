import { PageSectionHeader } from "@/components/shared"
import { HRSettingsView } from "@/features/settings"

export default async function HRSettingsGlobalPage() {
    return (
        <>
            <PageSectionHeader title="Configuración General RR.HH." description="Parámetros globales de recursos humanos" />
            <HRSettingsView activeTab="global" />
        </>)
}
