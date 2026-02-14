import { UsersSettingsView } from "@/components/settings/UsersSettingsView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function UsersSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "users"

    return <UsersSettingsView activeTab={activeTab} />
}
