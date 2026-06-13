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
        <div className="h-full flex flex-col">
            <Tabs value={activeTab} className="h-full flex flex-col">
                <StatementsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
