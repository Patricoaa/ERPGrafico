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
        <div className="h-full flex flex-col">
            <Tabs value={activeTab} className="flex flex-col h-full">
                <div className="flex-1 min-h-0">
                    <UoMsView activeTab={activeTab} externalOpen={modal === 'new'} />
                </div>
            </Tabs>
        </div>
    )
}
