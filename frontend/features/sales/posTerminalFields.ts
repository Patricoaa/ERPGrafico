import { createEntityFields } from "@/components/shared"
import type { Terminal } from "@/features/treasury"

export const posTerminalFields = createEntityFields<Terminal>()({
    code: {
        key: "code",
        type: "code",
        label: "Código",
    },
    name: {
        key: "name",
        type: "text",
        label: "Nombre",
    },
    location: {
        key: "location",
        type: "secondary",
        label: "Ubicación",
    },
    isActive: {
        key: "is_active",
        type: "status",
        label: "Estado",
        get: (t) => t.is_active ? "active" : "inactive",
        getLabel: (t) => t.is_active ? "Activo" : "Inactivo",
        tableOptions: { enableSorting: false },
    },
})
