import { createEntityFields } from "@/components/shared"
import type { AppUser } from "@/types/entities"
import { Chip } from "@/components/shared"
import { Users } from "lucide-react"

const SYSTEM_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY'] as const

const ROLE_INTENT: Record<string, 'primary' | 'warning' | 'info' | 'neutral'> = {
    ADMIN: 'primary',
    MANAGER: 'warning',
    OPERATOR: 'info',
    READ_ONLY: 'neutral',
}

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
        get: (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—',
    },
    role: {
        key: "role",
        type: "chip",
        label: "Rol",
        get: (u) => {
            const groups = (u.groups || []).map(g => typeof g === 'string' ? g : g.name)
            return groups.find(g => SYSTEM_ROLES.includes(g as typeof SYSTEM_ROLES[number])) ?? null
        },
        intent: (u) => {
            const groups = (u.groups || []).map(g => typeof g === 'string' ? g : g.name)
            const systemRole = groups.find(g => SYSTEM_ROLES.includes(g as typeof SYSTEM_ROLES[number]))
            return systemRole ? (ROLE_INTENT[systemRole] || 'neutral') : 'neutral'
        },
    },
    functionalGroups: {
        key: "groups",
        type: "computed",
        label: "Grupos",
        render: (u) => {
            const groups = (u.groups || []).map(g => typeof g === 'string' ? g : g.name)
            const functionalGroups = groups.filter(g => !SYSTEM_ROLES.includes(g as typeof SYSTEM_ROLES[number]))
            if (functionalGroups.length === 0) return null
            return (
                <div className="flex flex-wrap gap-1">
                    {functionalGroups.map(g => (
                        <Chip key={g} size="xs" intent="neutral" icon={Users}>
                            {g}
                        </Chip>
                    ))}
                </div>
            )
        },
    },
    isActive: {
        key: "is_active",
        type: "status",
        label: "Estado",
        get: (u) => u.is_active ? "active" : "inactive",
    },
})
