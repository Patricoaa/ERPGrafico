"use client"

import { UoMClientView } from "@/features/inventory"
import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"

export default function UoMUnitsPage() {
    const createAction = <ToolbarCreateButton label="Nueva Unidad" href="/inventory/products/uoms/units?modal=new" />

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            <PageSectionHeader
                title="Unidades de Medida"
                description="Configuración de métricas y factores de conversión estándar."
                subTabs={[
                    { value: "units", label: "Unidades", href: "/inventory/products/uoms/units" },
                    { value: "uom-categories", label: "Categorías de Medida", href: "/inventory/products/uoms/categories" },
                ]}
                subTabsBelow
            />
            <UoMClientView createAction={createAction} />
        </div>
    )
}
