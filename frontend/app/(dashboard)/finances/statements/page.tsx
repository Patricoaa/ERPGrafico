import { Tabs } from "@/components/ui/tabs"
import { StatementsView } from "@/features/finance"
import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function StatementsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    
    if (!tab) {
        redirect("/finances/statements?tab=bs")
    }

    const activeTab = tab

    return (
        <div className="flex-1 flex flex-col min-h-0 pt-0">
            <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0 space-y-4">
                <StatementsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
