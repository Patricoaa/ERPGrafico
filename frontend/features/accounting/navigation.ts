import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Contabilidad.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: CONFIGURACIÓN
// ============================================

export const ACCOUNTING_CONFIG_SUB_TABS: NavTabConfig[] = [
  {
    value: "vat-rates",
    label: "Tasas de IVA",
    href: "/accounting/settings/vat-rates",
    iconName: "percent",
    headerTitle: "Tasas de IVA",
    headerDescription: "Configuración de tasas de IVA y retenciones aplicables.",
    metadataTitle: "Tasas de IVA | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const ACCOUNTING_TABS: NavTabConfig[] = [
  {
    value: "ledger",
    label: "Plan de Cuentas",
    href: "/accounting/ledger",
    iconName: getEntityIconName("accounting.account") ?? "calculator",
    headerTitle: "Plan de Cuentas",
    headerDescription: "Estructura contable y clasificación de cuentas.",
    metadataTitle: "Plan de Cuentas | ERPGrafico",
    subTabs: [],
  },
  {
    value: "entries",
    label: "Asientos Contables",
    href: "/accounting/entries",
    iconName: getEntityIconName("accounting.journalentry") ?? "file-text",
    headerTitle: "Asientos Contables",
    headerDescription: "Libro diario y registro cronológico de transacciones.",
    metadataTitle: "Asientos Contables | ERPGrafico",
    subTabs: [],
  },
  {
    value: "closures",
    label: "Gestión de Cierres",
    href: "/accounting/closures",
    iconName: getEntityIconName("accounting.fiscalyear") ?? "calendar",
    headerTitle: "Gestión de Cierres",
    headerDescription: "Periodos tributarios (F29), cierres contables mensuales y cierre de ejercicios anuales.",
    metadataTitle: "Gestión de Cierres | ERPGrafico",
    subTabs: [],
  },
  {
    value: "config",
    label: "Configuración",
    href: "/accounting/settings",
    iconName: "settings",
    headerTitle: "Configuración",
    headerDescription: "Gestión de tasas de IVA y parámetros contables.",
    metadataTitle: "Configuración | ERPGrafico",
    subTabs: ACCOUNTING_CONFIG_SUB_TABS,
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de contabilidad */
export function getAccountingTab(value: string): NavTabConfig | undefined {
  return findTabConfig(ACCOUNTING_TABS, value)
}

/** Busca sub-tab de Configuración */
export function getAccountingConfigSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(ACCOUNTING_CONFIG_SUB_TABS, value)
}