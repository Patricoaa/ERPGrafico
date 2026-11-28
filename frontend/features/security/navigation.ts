import type { NavTabConfig } from "@/lib/navigation-types"
import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/**
 * Configuración canónica de navegación para el módulo de Seguridad y Control.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: USUARIOS Y ROLES
// ============================================

export const SECURITY_USERS_SUB_TABS: NavTabConfig[] = [
  {
    value: "users",
    label: "Usuarios",
    href: "/security/users",
    iconName: "users",
    headerTitle: "Usuarios",
    headerDescription: "Gestión de cuentas y accesos de usuario.",
    metadataTitle: "Usuarios | Seguridad",
  },
  {
    value: "groups",
    label: "Roles y Permisos",
    href: "/security/users/groups",
    iconName: "shield-check",
    headerTitle: "Roles y Permisos",
    headerDescription: "Grupos de usuarios y asignación de políticas de acceso.",
    metadataTitle: "Roles y Permisos | Seguridad",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const SECURITY_TABS: NavTabConfig[] = [
  {
    value: "users",
    label: "Usuarios y Roles",
    href: "/security/users",
    iconName: "users",
    headerTitle: "Usuarios y Roles",
    headerDescription: "Cuentas de usuario, equipos y asignación de permisos del sistema.",
    metadataTitle: "Usuarios y Roles | Seguridad",
    subTabs: SECURITY_USERS_SUB_TABS,
  },
  {
    value: "audit",
    label: "Auditoría",
    href: "/security/audit",
    iconName: "history",
    headerTitle: "Auditoría",
    headerDescription: "Trazabilidad completa de acciones y cambios en el sistema.",
    metadataTitle: "Auditoría | Seguridad",
    subTabs: [],
  },
  {
    value: "jobs",
    label: "Procesos",
    href: "/security/jobs",
    iconName: "server-cog",
    headerTitle: "Procesos",
    headerDescription: "Monitoreo de tareas asíncronas, importaciones y colas de trabajo.",
    metadataTitle: "Procesos | Seguridad",
    subTabs: [],
  },
  {
    value: "debug",
    label: "Depuración",
    href: "/security/debug",
    iconName: "bug",
    headerTitle: "Depuración",
    headerDescription: "Herramientas de diagnóstico, simulación y reloj del servidor.",
    metadataTitle: "Depuración | Seguridad",
    subTabs: [],
  },
]

/** Busca tab principal de Seguridad */
export function getSecurityTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SECURITY_TABS, value)
}

/** Busca sub-tab de Usuarios */
export function getSecurityUsersSubTab(value: string): NavTabConfig | undefined {
  return findSubTabConfig(SECURITY_TABS, "users", value)
}
