import { Tabs } from "@/components/ui/tabs"
import { AnalysisView } from "@/features/finance"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AnalysisPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "ratios"

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <AnalysisView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
