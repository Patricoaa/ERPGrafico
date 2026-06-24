import { PageSectionHeader } from "@/components/shared"
import { HRSettingsView } from "@/features/settings"

export default async function HRSettingsConceptsPage() {
    return (
        <>
            <PageSectionHeader title="Conceptos de Remuneración" description="Definición de haberes y descuentos" />
            <HRSettingsView activeTab="concepts" />
        </>)
}
