import { defineEntity } from "@/components/entity-view"
import type { Account } from "@/types/entities"

export const selectorAccountEntity = defineEntity<Account>()((f) => ({
    title: "Cuenta",
    rowId: (a) => a.id,
    fields: {
        code: f.code("code", { label: "Código", sortable: false }),
        name: f.text("name", { label: "Nombre", sortable: false }),
        type: f.text("account_type", { label: "Tipo", sortable: false }),
    },
}))

export const selectorAccountViews = selectorAccountEntity.views({
    table: {
        columns: ["code", "name", "type"],
        primary: "name",
    },
})
