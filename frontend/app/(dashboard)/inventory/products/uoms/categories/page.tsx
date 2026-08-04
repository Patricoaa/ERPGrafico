"use client"

import { UoMCategoryClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

export default function UoMCategoriesPage() {
    const createAction = <ToolbarCreateButton label="Nueva Categoría" href="/inventory/products/uoms/categories?modal=new" />

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            <UoMCategoryClientView createAction={createAction} />
        </div>
    )
}
