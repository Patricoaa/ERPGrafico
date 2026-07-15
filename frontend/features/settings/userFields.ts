import { createEntityFields } from "@/components/shared"
import type { AppUser } from "@/types/entities"

export const userFields = createEntityFields<AppUser>()({
    username: {
        key: "username",
        type: "text",
        label: "Usuario",
    },
    email: {
        key: "email",
        type: "text",
        label: "Email",
    },
    isActive: {
        key: "is_active",
        type: "status",
        label: "Estado",
        get: (u) => u.is_active ? "active" : "inactive",
    },
})
