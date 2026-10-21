"use client"

import { DynamicIcon } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { Category } from "../hooks/useCategories"

/**
 * Feature extension: Lucide icon chosen by name for a category (replaces the `computed` icon
 * column). Used by one entity → lives with it (Gate B rule). Unknown names fall back to Package.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        categoryIcon: { value: string | null | undefined; options: Record<never, never> }
    }
}

function IconTile({ name }: { name: string }) {
    return (
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-muted-foreground/10 bg-muted/30">
            <DynamicIcon name={name} className="h-4 w-4 text-muted-foreground/70" />
        </div>
    )
}

function CategoryIconCell({ value }: ValueRenderProps<"categoryIcon">) {
    return <div className="flex w-full justify-center">{value ? <IconTile name={value} /> : "—"}</div>
}

function CategoryAvatar({ row }: { row: Category }) {
    return <IconTile name={row.icon || "package"} />
}

let registered = false
function registerCategoryValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("categoryIcon", {
        format: (v) => v ?? "",
        align: "center",
        render: CategoryIconCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerCategoryValueKinds()

/** Product category (ADR-0087 oleada A1). Replaces categoryFields.tsx (1 computed) + renderCard. */
export const categoryEntity = defineEntity<Category>()((f) => ({
    label: "inventory.category",
    fields: {
        icon: f.value("categoryIcon", "icon", { label: "Icono", sortable: false }),
        prefix: f.code("prefix", { label: "Siglas" }),
        name: f.text("name", { label: "Nombre" }),
        parentName: f.text("parent_name", { label: "Categoría Padre", tone: "secondary" }),
        isActive: f.status((c) => (c.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
}))

export const categoryViews = categoryEntity.views({
    table: { columns: ["icon", "prefix", "name", "parentName", "isActive"], primary: "name", defaultSort: "name" },
    card: { title: "name", subtitle: ["prefix"], meta: ["parentName"], trailing: ["isActive"], media: { avatar: CategoryAvatar } },
})
