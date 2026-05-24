import { TreasurySettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function TreasurySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "conciliation"

    return (
        <TreasurySettingsView activeTab={activeTab} />
    )
}
