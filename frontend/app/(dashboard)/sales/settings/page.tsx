import { SalesSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function SalesSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "income"

    return (
        <SalesSettingsView activeTab={activeTab} />
    )
}
