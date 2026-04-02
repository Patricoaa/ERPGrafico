import { Tabs } from "@/components/ui/tabs"
import { PageTabs } from "@/components/shared/PageTabs"
import { StatementsView } from "@/features/finance/components/StatementsView"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function StatementsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "bs"

    const tabs = [
        { value: "bs", label: "Balance", iconName: "file-text", href: "/finances?view=statements&tab=bs" },
        { value: "pl", label: "Resultados", iconName: "bar-chart-2", href: "/finances?view=statements&tab=pl" },
        { value: "cf", label: "Flujos", iconName: "trending-up", href: "/finances?view=statements&tab=cf" },
    ]

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-sm" />
                <StatementsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
