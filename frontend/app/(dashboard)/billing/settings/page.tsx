import { BillingSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "accounts"

    return (
        <BillingSettingsView activeTab={configTab} />
    )
}
