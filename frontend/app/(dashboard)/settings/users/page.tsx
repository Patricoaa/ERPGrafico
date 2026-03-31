import { UsersSettingsView } from "@/features/settings/components/UsersSettingsView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function UsersSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "users"

    return <UsersSettingsView activeTab={activeTab} />
}
