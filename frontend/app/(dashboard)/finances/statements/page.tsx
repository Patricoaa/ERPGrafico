import { Tabs } from "@/components/ui/tabs"
import { StatementsView } from "@/features/finance"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function StatementsPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "bs"

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <StatementsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
