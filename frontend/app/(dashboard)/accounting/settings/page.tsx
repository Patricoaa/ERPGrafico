import { AccountingSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AccountingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "structure"

    return (
        <AccountingSettingsView activeTab={activeTab} />
    )
}
