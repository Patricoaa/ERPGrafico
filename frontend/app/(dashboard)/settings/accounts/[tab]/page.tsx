import { redirect } from "next/navigation"
import { PageSectionHeader } from "@/components/shared"
import { UnifiedAccountsView, VALID_ACCOUNT_TABS, DEFAULT_ACCOUNT_TAB, ACCOUNT_TABS } from "@/features/settings"

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
                title="Cuentas Contables"
                description="Cuentas contables por defecto de cada módulo del sistema"
                subTabs={ACCOUNT_TABS.map(t => ({ value: t.value, label: t.label, href: `/settings/accounts/${t.value}` }))}
                subTabsBelow
            />
            <UnifiedAccountsView activeTab={tab} />
        </>
    )
}
