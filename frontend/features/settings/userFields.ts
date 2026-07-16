import { createEntityFields } from "@/components/shared"
import type { AppUser } from "@/types/entities"

const SYSTEM_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY'] as const

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
    fullName: {
        key: "full_name",
        type: "text",
        label: "Nombre",
        cardPlacement: "body",
        get: (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—',
    },
    role: {
        key: "role",
        type: "text",
        label: "Rol",
        cardPlacement: "body",
        get: (u) => {
            const groups = (u.groups || []).map(g => typeof g === 'string' ? g : g.name)
            return groups.find(g => SYSTEM_ROLES.includes(g as typeof SYSTEM_ROLES[number])) ?? null
        },
    },
    isActive: {
        key: "is_active",
        type: "status",
        label: "Estado",
        get: (u) => u.is_active ? "active" : "inactive",
    },
})
