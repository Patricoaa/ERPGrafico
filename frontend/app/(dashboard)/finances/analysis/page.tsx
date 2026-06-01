import { Tabs } from "@/components/ui/tabs"
import { AnalysisView } from "@/features/finance"
import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function AnalysisPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    
    if (!tab) {
        redirect("/finances/analysis?tab=ratios")
    }

    const activeTab = tab

    return (
        <div className="flex-1 flex flex-col min-h-0 pt-0">
            <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0 space-y-4">
                <AnalysisView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
