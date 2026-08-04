import { createEntityFields } from "@/components/shared"
import { AttributeValuesSummary } from "./components/AttributeValuesSummary"
import type { Attribute } from "./hooks/useAttributes"

export const attributeFields = createEntityFields<Attribute>()({
    name: {
        key: "name",
        type: "text",
        label: "Atributo",
    },
    values: {
        key: "values",
        type: "computed",
        label: "Valores",
        fieldRole: "tag",
        render: (a) => <AttributeValuesSummary attribute={a} />,
    },
}, {
    subtitle: { renderer: () => [] },
})
