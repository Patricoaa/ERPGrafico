import { createEntityFields } from "@/components/shared"
import type { Attribute } from "./hooks/useAttributes"

export const attributeFields = createEntityFields<Attribute>()({
    name: {
        key: "name",
        type: "text",
        label: "Atributo",
    },
    values: {
        key: "values",
        type: "chip",
        label: "Valores",
        get: (a) => a.values?.map(v => v.value).join(', ') ?? '',
    },
}, {
    subtitle: { renderer: () => [] },
})
