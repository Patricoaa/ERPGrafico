import { Tabs } from "@/components/ui/tabs"
import { Scale, Layers } from "lucide-react"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { UoMsView } from "@/features/inventory/components/UoMsView"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function UnifiedUoMPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "units"

    const tabs = [
        { value: "units", label: "Unidades", icon: Scale, href: "/inventory/uoms?tab=units" },
        { value: "categories", label: "Categorías", icon: Layers, href: "/inventory/uoms?tab=categories" },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-sm" />
                <UoMsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
