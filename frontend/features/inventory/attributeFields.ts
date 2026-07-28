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
    values: {
        key: "values",
        type: "chip",
        label: "Valores",
        get: (a) => a.values?.map(v => v.value).join(', ') ?? '',
    },
})
