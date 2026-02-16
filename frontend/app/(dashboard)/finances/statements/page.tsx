import { Tabs } from "@/components/ui/tabs"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { StatementsView } from "@/components/finances/StatementsView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function StatementsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "bs"

    const tabs = [
        { value: "bs", label: "Balance", iconName: "file-text", href: "/finances/statements?tab=bs" },
        { value: "pl", label: "Resultados", iconName: "bar-chart-2", href: "/finances/statements?tab=pl" },
        { value: "cf", label: "Flujos", iconName: "trending-up", href: "/finances/statements?tab=cf" },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-sm" />
                <StatementsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
