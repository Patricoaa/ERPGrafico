import { redirect } from "next/navigation"
import { HRSettingsView } from "@/features/settings"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function HRSettingsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const configTab = tab || "global"

    if (!tab) {
        redirect('/hr/settings?tab=global')
    }

    return (
        <HRSettingsView activeTab={configTab} />
    )
}
