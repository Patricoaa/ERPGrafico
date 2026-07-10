"use client"

import { usePathname } from "next/navigation"
import { TabBar, TabBarContent } from "@/components/shared"
import { CategoryClientView, AttributesClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

const TABS = [
    { value: "categories", label: "Categorías" },
    { value: "attributes", label: "Atributos" },
]

export default function SettingsProductsPage() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const tabSegment = segments[3]
    const activeTab = tabSegment === 'attributes' ? 'attributes' : 'categories'

    const createAction = activeTab === 'categories'
        ? <ToolbarCreateButton label="Nueva Categoría" href="/inventory/settings/products/categories?modal=new" />
        : <ToolbarCreateButton label="Nuevo Atributo" href="/inventory/settings/products/attributes?modal=new" />

    return (
        <TabBar
            items={TABS}
            value={activeTab}
            onValueChange={() => {}}
            variant="underline"
        >
            <TabBarContent value="categories" className="mt-0 flex-1 overflow-hidden">
                <CategoryClientView createAction={createAction} />
            </TabBarContent>
            <TabBarContent value="attributes" className="mt-0 flex-1 overflow-hidden">
                <AttributesClientView createAction={createAction} />
            </TabBarContent>
        </TabBar>
    )
}
