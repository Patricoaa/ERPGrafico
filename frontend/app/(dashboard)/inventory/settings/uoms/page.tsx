"use client"

import { usePathname } from "next/navigation"
import { TabBar, TabBarContent } from "@/components/shared"
import { UoMClientView, UoMCategoryClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

const TABS = [
    { value: "units", label: "Unidades" },
    { value: "uom-categories", label: "Categorías de Medida" },
]

export default function SettingsUoMsPage() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const tabSegment = segments[3]
    const activeTab = tabSegment === 'categories' ? 'uom-categories' : 'units'

    const createAction = activeTab === 'units'
        ? <ToolbarCreateButton label="Nueva Unidad" href="/inventory/settings/uoms/units?modal=new" />
        : <ToolbarCreateButton label="Nueva Categoría" href="/inventory/settings/uoms/categories?modal=new" />

    return (
        <TabBar
            items={TABS}
            value={activeTab}
            onValueChange={() => {}}
            variant="underline"
        >
            <TabBarContent value="units" className="mt-0 flex-1 overflow-hidden">
                <UoMClientView createAction={createAction} />
            </TabBarContent>
            <TabBarContent value="uom-categories" className="mt-0 flex-1 overflow-hidden">
                <UoMCategoryClientView createAction={createAction} />
            </TabBarContent>
        </TabBar>
    )
}
