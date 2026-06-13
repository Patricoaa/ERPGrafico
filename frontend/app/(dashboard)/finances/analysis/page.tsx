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
        <div className="h-full flex flex-col">
            <Tabs value={activeTab} className="h-full flex flex-col">
                <AnalysisView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
