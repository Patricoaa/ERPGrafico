import { redirect } from "next/navigation"
import { PageSectionHeader } from "@/components/shared"
import { UnifiedAccountsView, VALID_ACCOUNT_TABS, DEFAULT_ACCOUNT_TAB } from "@/features/settings"

export default async function SettingsAccountsTabPage({
    params,
}: {
    params: Promise<{ tab: string }>
}) {
    const { tab } = await params

    if (!VALID_ACCOUNT_TABS.includes(tab)) {
        redirect(`/settings/accounts/${DEFAULT_ACCOUNT_TAB}`)
    }

    return (
        <>
            <PageSectionHeader
                title="Cuentas de Usuario"
                description="Gestión unificada de cuentas del sistema"
            />
            <UnifiedAccountsView activeTab={tab} />
        </>
    )
}
