import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Recursos Humanos.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: LIQUIDACIONES Y REMUNERACIONES
// ============================================

export const HR_PAYROLLS_SUB_TABS: NavTabConfig[] = [
  {
    value: "payrolls",
    label: "Liquidaciones",
    href: "/hr/payrolls",
    iconName: getEntityIconName("hr.payroll") ?? "file-spreadsheet",
    headerTitle: "Liquidaciones",
    headerDescription: "Cálculo de haberes, descuentos y generación de pagos.",
    metadataTitle: "Liquidaciones | ERPGrafico",
  },
  {
    value: "concepts",
    label: "Conceptos de Nómina",
    href: "/hr/payrolls/concepts",
    iconName: getEntityIconName("hr.payrollconcept") ?? "alert-circle",
    headerTitle: "Conceptos de Nómina",
    headerDescription: "Gestión de conceptos de nómina: haberes, descuentos, bonos y deducciones.",
    metadataTitle: "Conceptos de Nómina | ERPGrafico",
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
    value: "movements",
    label: "Movimientos",
    href: "/hr/movements",
    iconName: getEntityIconName("hr.employeemovement") ?? "hand-coins",
    headerTitle: "Movimientos con Empleados",
    headerDescription: "Pagos de remuneración, anticipos y préstamos del personal.",
    metadataTitle: "Movimientos con Empleados | ERPGrafico",
    subTabs: [],
  },
  {
    value: "payrolls",
    label: "Liquidaciones",
    href: "/hr/payrolls",
    iconName: getEntityIconName("hr.payroll") ?? "file-spreadsheet",
    headerTitle: "Liquidaciones",
    headerDescription: "Cálculo de haberes, descuentos y generación de pagos.",
    metadataTitle: "Liquidaciones | ERPGrafico",
    subTabs: HR_PAYROLLS_SUB_TABS,
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

/** Busca sub-tab de Liquidaciones */
export function getHRPayrollsSubTab(value: string): NavTabConfig | undefined {
  return findSubTabConfig(HR_TABS, "payrolls", value)
}


