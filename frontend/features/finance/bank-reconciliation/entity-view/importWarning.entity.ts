import { defineEntity } from "@/components/entity-view"

export interface ImportWarning {
    line: number | null
    message: string
}

const fixed = { sortable: false } as const

export const importWarningEntity = defineEntity<ImportWarning>()((f) => ({
    title: "Advertencias de importación",
    fields: {
        line: f.code((r) => r.line ?? "General", { ...fixed, label: "Línea" }),
        type: f.status(() => ({ status: "WARNING", label: "Advertencia" }), { ...fixed, label: "Tipo" }),
        message: f.text("message", { ...fixed, label: "Mensaje", tone: "secondary" }),
    },
}))

export const importWarningViews = importWarningEntity.views({
    table: { columns: ["line", "type", "message"] },
})
