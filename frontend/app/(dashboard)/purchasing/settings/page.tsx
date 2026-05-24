import { PurchasingSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function PurchasingSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "global"

    return (
        <PurchasingSettingsView />
    )
}
