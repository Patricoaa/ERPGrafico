import { ProfileView } from "@/features/profile/components/ProfileView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function ProfilePage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "account"

    return <ProfileView activeTab={activeTab} />
}
