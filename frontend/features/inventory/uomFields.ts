import { createEntityFields } from "@/components/shared"
import type { UoM } from "./hooks/useUoMs"

const UOM_STATUS_MAP: Record<UoM['uom_type'], { status: string; label: string }> = {
    REFERENCE: { status: 'INFO',    label: 'Referencia' },
    BIGGER:    { status: 'SUCCESS', label: 'Mayor'      },
    SMALLER:   { status: 'WARNING', label: 'Menor'      },
}

export const uomFields = createEntityFields<UoM>()({
    id: {
        key: "id",
        type: "code",
        label: "Código Interno",
        tableOptions: { width: 80 },
    },
    name: {
        key: "name",
        type: "text",
        label: "Nombre",
    },
    abbreviation: {
        key: "abbreviation",
        type: "code",
        label: "Abreviación",
    },
    nameSingular: {
        key: "name_singular",
        type: "secondary",
        label: "Singular",
    },
    namePlural: {
        key: "name_plural",
        type: "secondary",
        label: "Plural",
    },
    categoryName: {
        key: "category_name",
        type: "secondary",
        label: "Categoría",
    },
    uomType: {
        key: "uom_type",
        type: "status",
        label: "Tipo",
        get: (u) => UOM_STATUS_MAP[u.uom_type]?.status || 'NEUTRAL',
        getLabel: (u) => UOM_STATUS_MAP[u.uom_type]?.label || u.uom_type,
    },
    ratio: {
        key: "ratio",
        type: "number",
        label: "Ratio",
    },
})
