"use client"

import { usePathname } from "next/navigation"
import { UoMClientView, UoMCategoryClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

export default function ProductsUoMsPage() {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const tabSegment = segments[3]
    const activeTab = tabSegment === 'categories' ? 'uom-categories' : 'units'

    const createAction = activeTab === 'units'
        ? <ToolbarCreateButton label="Nueva Unidad" href="/inventory/products/uoms/units?modal=new" />
        : <ToolbarCreateButton label="Nueva Categoría" href="/inventory/products/uoms/categories?modal=new" />

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'units' ? (
                <UoMClientView createAction={createAction} />
            ) : (
                <UoMCategoryClientView createAction={createAction} />
            )}
        </div>
    )
}
