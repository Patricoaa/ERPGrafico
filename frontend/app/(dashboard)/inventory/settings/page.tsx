import { InventorySettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function InventorySettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "accounts"

    return (
        <InventorySettingsView activeTab={activeTab} />
    )
}
