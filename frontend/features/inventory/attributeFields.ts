import { createEntityFields } from "@/components/shared"

interface ProductAttributeValue {
    id: number
    attribute: number
    value: string
}

interface ProductAttribute {
    id: number
    name: string
    values?: ProductAttributeValue[]
}

export const attributeFields = createEntityFields<ProductAttribute>()({
    name: {
        key: "name",
        type: "text",
        label: "Atributo",
    },
    valueCount: {
        key: "values",
        type: "text",
        label: "Valores",
        get: (a) => `${a.values?.length ?? 0} valores`,
    },
    values: {
        key: "values",
        type: "chip",
        label: "Valores",
        get: (a) => a.values?.map(v => v.value).join(', ') ?? '',
    },
})
