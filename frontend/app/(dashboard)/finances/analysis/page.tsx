import { Tabs } from "@/components/ui/tabs"
import { PageTabs } from "@/components/shared/PageTabs"
import { AnalysisView } from "@/features/finance/components/AnalysisView"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AnalysisPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "ratios"

    const tabs = [
        { value: "ratios", label: "Ratios Financieros", iconName: "pie-chart", href: "/finances?view=analysis&tab=ratios" },
        { value: "bi", label: "Business Intelligence", iconName: "activity", href: "/finances?view=analysis&tab=bi" },
    ]

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-sm" />
                <AnalysisView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
