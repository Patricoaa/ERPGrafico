"use client"

import { Tag } from "lucide-react"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { AttributeValuesSummary } from "../components/AttributeValuesSummary"
import type { Attribute } from "../hooks/useAttributes"

/**
 * Feature extension: the editable chips of an attribute's values (replaces the `computed` column).
 * The add/delete callbacks come from `AttributeValuesProvider` around the collection.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        attributeValues: { value: Attribute; options: Record<never, never> }
    }
}

function AttributeValuesCell({ value }: ValueRenderProps<"attributeValues">) {
    return <AttributeValuesSummary attribute={value} />
}

let registered = false
function registerAttributeValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("attributeValues", {
        format: (a) => (a.values ?? []).map((v) => v.value).join(", "),
        align: "center",
        render: AttributeValuesCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerAttributeValueKinds()

/** Product attribute (ADR-0087 oleada A1). Replaces attributeFields.tsx (1 computed) + renderCard. */
export const attributeEntity = defineEntity<Attribute>()((f) => ({
    label: "inventory.attribute",
    fields: {
        name: f.text("name", { label: "Atributo" }),
        values: f.value("attributeValues", (a) => a, { label: "Valores", sortable: false }),
    },
}))

export const attributeViews = attributeEntity.views({
    table: { columns: ["name", "values"], defaultSort: "name" },
    card: { title: "name", trailing: ["values"], media: { icon: Tag } },
})
