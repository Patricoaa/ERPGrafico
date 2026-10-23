"use client"

import { Tag } from "lucide-react"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { AttributeValuesSummary } from "../components/AttributeValuesSummary"
import type { Attribute } from "../hooks/useAttributes"

/**
 * Feature extension: the chips of an attribute's values (replaces the `computed` column).
 * The table keeps the add/delete controls; cards render the same chips read-only.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        attributeValues: { value: Attribute; options: Record<never, never> }
    }
}

const VALUE_TYPE_LABELS: Record<Attribute["value_type"], string> = {
    text: "Texto",
    number: "Número",
    date: "Fecha",
    boolean: "Booleano",
}

function valuesLabel(attribute: Attribute): string {
    const count = attribute.values?.length ?? 0
    if (count === 0) return "Sin valores"
    return count === 1 ? "1 valor" : `${count} valores`
}

function AttributeValuesCell({ value, surface, align }: ValueRenderProps<"attributeValues">) {
    return <AttributeValuesSummary attribute={value} readOnly={surface !== "table"} align={align} />
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
        code: f.code("code", { label: "Código" }),
        name: f.text("name", { label: "Atributo" }),
        valueType: f.text((a) => VALUE_TYPE_LABELS[a.value_type] ?? a.value_type, { label: "Tipo", tone: "secondary" }),
        values: f.value("attributeValues", (a) => a, { label: "Valores", sortable: false }),
        isActive: f.status((a) => (a.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
}))

export const attributeViews = attributeEntity.views({
    table: { columns: ["name", "values", "isActive"], defaultSort: "name" },
    card: {
        code: "code",
        title: "name",
        subtitle: ["valueType"],
        highlights: ["values"],
        muted: (a) => !a.is_active,
        media: {
            placement: "top",
            icon: Tag,
            badge: (a) => (a.is_active ? undefined : "Archivado"),
            footnote: valuesLabel,
        },
    },
})
