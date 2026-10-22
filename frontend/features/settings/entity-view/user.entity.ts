import { defineEntity } from "@/components/entity-view"
import type { AppUser } from "@/types/entities"

const SYSTEM_ROLES: readonly string[] = ["ADMIN", "MANAGER", "OPERATOR", "READ_ONLY"]

const groupNames = (u: AppUser): string[] => (u.groups ?? []).map((g) => (typeof g === "string" ? g : g.name))
const fullName = (u: AppUser): string => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()

/** System user (ADR-0087 oleada A1). Replaces userFields.tsx (1 computed) + the inline contact column + renderCard. */
export const userEntity = defineEntity<AppUser>()((f) => ({
    label: "core.user",
    fields: {
        username: f.text("username", { label: "Usuario" }),
        email: f.text("email", { label: "Email" }),
        fullName: f.text((u) => fullName(u) || null, { label: "Nombre" }),
        role: f.tags((u) => groupNames(u).filter((g) => SYSTEM_ROLES.includes(g)).slice(0, 1), { label: "Rol", domain: "user_role" }),
        groups: f.tags((u) => groupNames(u).filter((g) => !SYSTEM_ROLES.includes(g)), { label: "Grupos", sortable: false }),
        isActive: f.status((u) => (u.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Inactivo" }), { label: "Estado" }),
        contact: f.contact((u) => (u.contact ? { id: u.contact, name: fullName(u) || u.username } : null), { label: "Contacto", sortable: false }),
    },
}))

export const userViews = userEntity.views({
    table: { columns: ["username", "email", "fullName", "role", "groups", "isActive", "contact"] },
    card: { title: "username", subtitle: ["fullName", "email"], meta: ["role", "groups"], trailing: ["isActive"] },
})
