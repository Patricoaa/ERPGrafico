import { Tabs } from "@/components/ui/tabs"
import { redirect } from "next/navigation"
import { UoMsView } from "@/features/inventory"

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function UnifiedUoMPage({ searchParams }: PageProps) {
    const { tab, modal } = await searchParams
    const activeTab = tab || "units"

    if (!tab) {
        redirect('/inventory/uoms?tab=units')
    }

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <UoMsView activeTab={activeTab} externalOpen={modal === 'new'} />
            </Tabs>
        </div>
    )
}
