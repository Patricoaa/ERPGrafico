import { PageSectionHeader } from "@/components/shared"
import { UnifiedAccountsView } from "@/features/settings"

export default async function SettingsAccountsPage() {
    return (
        <>
            <PageSectionHeader title="Cuentas de Usuario" description="Gestión unificada de cuentas del sistema" />
            <UnifiedAccountsView />
        </>)
}
