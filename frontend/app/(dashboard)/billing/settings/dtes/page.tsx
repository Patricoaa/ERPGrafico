import { PageSectionHeader } from "@/components/shared"
import { BillingSettingsView } from "@/features/settings"

export default async function BillingSettingsDtesPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Configuración DTE" description="Parámetros de documentos tributarios electrónicos" />
            <BillingSettingsView />
        </>)
}
