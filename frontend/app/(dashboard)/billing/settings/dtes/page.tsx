import { PageSectionHeader } from "@/components/shared"
import { BillingSettingsView } from "@/features/settings"

export default async function BillingSettingsDtesPage() {
    return (
        <>
            <PageSectionHeader title="Configuración DTE" description="Parámetros de documentos tributarios electrónicos" />
            <BillingSettingsView />
        </>)
}
