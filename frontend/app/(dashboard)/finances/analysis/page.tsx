import { Tabs } from "@/components/ui/tabs"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { AnalysisView } from "@/features/finances/components/AnalysisView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AnalysisPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "ratios"

    const tabs = [
        { value: "ratios", label: "Ratios Financieros", iconName: "pie-chart", href: "/finances/analysis?tab=ratios" },
        { value: "bi", label: "Business Intelligence", iconName: "activity", href: "/finances/analysis?tab=bi" },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-sm" />
                <AnalysisView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
