"use client"

import { UoMCategoryClientView } from "@/features/inventory"
import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"

export default function UoMCategoriesPage() {
    const createAction = <ToolbarCreateButton label="Nueva Categoría" href="/inventory/products/uoms/categories?modal=new" />

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            <PageSectionHeader
                title="Categorías de Medida"
                description="Clasificación de magnitudes compatibles (peso, volumen, longitud)."
                subTabs={[
                    { value: "units", label: "Unidades", href: "/inventory/products/uoms/units" },
                    { value: "uom-categories", label: "Categorías de Medida", href: "/inventory/products/uoms/categories" },
                ]}
                subTabsBelow
            />
            <UoMCategoryClientView createAction={createAction} />
        </div>
    )
}
