import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Recursos Humanos.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: CONFIGURACIÓN
// ============================================

export const HR_CONFIG_SUB_TABS: NavTabConfig[] = [
  {
    value: "global",
    label: "Globales",
    href: "/hr/settings/global",
    iconName: "settings-2",
    headerTitle: "Globales",
    headerDescription: "Configuración general de RRHH, parámetros de la empresa y económicos.",
    metadataTitle: "Globales | ERPGrafico",
  },
  {
    value: "concepts",
    label: "Conceptos",
    href: "/hr/settings/concepts",
    iconName: "alert-circle",
    headerTitle: "Conceptos",
    headerDescription: "Gestión de conceptos de nómina: haberes, descuentos, bonos y deducciones.",
    metadataTitle: "Conceptos | ERPGrafico",
  },
  {
    value: "previsional",
    label: "Previsión",
    href: "/hr/settings/previsional",
    iconName: "loader-2",
    headerTitle: "Previsión",
    headerDescription: "Configuración de instituciones previsionales, salud y seguros.",
    metadataTitle: "Previsión | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const HR_TABS: NavTabConfig[] = [
  {
    value: "employees",
    label: "Nómina de Personal",
    href: "/hr/employees",
    iconName: getEntityIconName("hr.employee") ?? "users",
    headerTitle: "Nómina de Personal",
    headerDescription: "Gestión de fichas de empleados y cargos.",
    metadataTitle: "Nómina de Personal | ERPGrafico",
    subTabs: [],
  },
  {
    value: "absences",
    label: "Inasistencias y Licencias",
    href: "/hr/absences",
    iconName: getEntityIconName("hr.absence") ?? "calendar-off",
    headerTitle: "Inasistencias y Licencias",
    headerDescription: "Control de ausencias, permisos y licencias médicas.",
    metadataTitle: "Inasistencias y Licencias | ERPGrafico",
    subTabs: [],
  },
  {
    value: "advances",
    label: "Anticipos de Sueldo",
    href: "/hr/advances",
    iconName: getEntityIconName("hr.salaryadvance") ?? "hand-coins",
    headerTitle: "Anticipos de Sueldo",
    headerDescription: "Gestión de adelantos y préstamos de personal.",
    metadataTitle: "Anticipos de Sueldo | ERPGrafico",
    subTabs: [],
  },
  {
    value: "payrolls",
    label: "Liquidaciones y Remuneraciones",
    href: "/hr/payrolls",
    iconName: getEntityIconName("hr.payroll") ?? "file-spreadsheet",
    headerTitle: "Liquidaciones y Remuneraciones",
    headerDescription: "Cálculo de haberes, descuentos y generación de pagos.",
    metadataTitle: "Liquidaciones y Remuneraciones | ERPGrafico",
    subTabs: [],
  },
  {
    value: "config",
    label: "Configuración",
    href: "/hr/settings",
    iconName: "settings",
    headerTitle: "Configuración",
    headerDescription: "Gestione indicadores económicos, conceptos de nómina e instituciones previsionales.",
    metadataTitle: "Configuración | ERPGrafico",
    subTabs: HR_CONFIG_SUB_TABS,
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de RRHH */
export function getHRTab(value: string): NavTabConfig | undefined {
  return findTabConfig(HR_TABS, value)
}

/** Busca sub-tab de Configuración */
export function getHRConfigSubTab(value: string): NavTabConfig | undefined {
  return findSubTabConfig(HR_TABS, "config", value)
}