import { BillingSettingsView } from "@/components/settings/BillingSettingsView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "accounts"

    return <BillingSettingsView activeTab={activeTab} />
}
