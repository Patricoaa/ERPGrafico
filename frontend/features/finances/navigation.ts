import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Finanzas.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: ESTADOS FINANCIEROS
// ============================================

export const FINANCES_STATEMENTS_SUB_TABS: NavTabConfig[] = [
  {
    value: "bs",
    label: "Balance General",
    href: "/finances/statements/bs",
    iconName: "file-text",
    headerTitle: "Balance General",
    headerDescription: "Situación patrimonial y financiera del período",
    metadataTitle: "Balance General | ERPGrafico",
  },
  {
    value: "pl",
    label: "Estado de Resultados",
    href: "/finances/statements/pl",
    iconName: "bar-chart-2",
    headerTitle: "Estado de Resultados",
    headerDescription: "Ingresos, costos y resultados del período",
    metadataTitle: "Estado de Resultados | ERPGrafico",
  },
  {
    value: "cf",
    label: "Flujo de Caja",
    href: "/finances/statements/cf",
    iconName: "trending-up",
    headerTitle: "Flujo de Caja",
    headerDescription: "Movimientos de efectivo del período",
    metadataTitle: "Flujo de Caja | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: ANÁLISIS
// ============================================

export const FINANCES_ANALYSIS_SUB_TABS: NavTabConfig[] = [
  {
    value: "ratios",
    label: "Ratios Financieros",
    href: "/finances/analysis/ratios",
    iconName: "pie-chart",
    headerTitle: "Ratios Financieros",
    headerDescription: "Métricas de liquidez, solvencia y rentabilidad.",
    metadataTitle: "Ratios Financieros | ERPGrafico",
  },
  {
    value: "bi",
    label: "Business Intelligence",
    href: "/finances/analysis/bi",
    iconName: "activity",
    headerTitle: "Business Intelligence",
    headerDescription: "Análisis visual de métricas de rentabilidad y evolución.",
    metadataTitle: "Business Intelligence | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: PRESUPUESTOS
// ============================================

export const FINANCES_BUDGETS_SUB_TABS: NavTabConfig[] = [
  {
    value: "list",
    label: "Control Presupuestario",
    href: "/finances/budgets/list",
    iconName: "list",
    headerTitle: "Control Presupuestario",
    headerDescription: "Gestión de metas presupuestarias y ejecución.",
    metadataTitle: "Control Presupuestario | ERPGrafico",
  },
  {
    value: "versus",
    label: "Versus Presupuestario",
    href: "/finances/budgets/versus",
    iconName: "chart-bar",
    headerTitle: "Versus Presupuestario",
    headerDescription: "Análisis de variaciones mes y acumulado.",
    metadataTitle: "Versus Presupuestario | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: CAPITAL Y SOCIOS
// ============================================

export const FINANCES_PARTNERS_SUB_TABS: NavTabConfig[] = [
  {
    value: "composition",
    label: "Composición Societaria",
    href: "/finances/partners/composition",
    iconName: "users",
    headerTitle: "Composición Societaria",
    headerDescription: "Gestión de capital suscrito y pagado por los socios.",
    metadataTitle: "Composición Societaria | ERPGrafico",
  },
  {
    value: "distributions",
    label: "Distribución de Utilidades",
    href: "/finances/partners/distributions",
    iconName: getEntityIconName("contacts.profitdistributionresolution") ?? "pie-chart",
    headerTitle: "Distribución de Utilidades",
    headerDescription: "Gestión de actas, resolución de dividendos y reinversiones.",
    metadataTitle: "Distribución de Utilidades | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const FINANCES_TABS: NavTabConfig[] = [
  {
    value: "statements",
    label: "Estados Financieros",
    href: "/finances/statements/bs",
    iconName: "clipboard-list",
    headerTitle: "Estados Financieros",
    headerDescription: "Reportes oficiales de Balance, P&L y Flujo de Caja.",
    metadataTitle: "Estados Financieros | ERPGrafico",
    subTabs: FINANCES_STATEMENTS_SUB_TABS,
  },
  {
    value: "analysis",
    label: "Análisis Financiero",
    href: "/finances/analysis/ratios",
    iconName: "line-chart",
    headerTitle: "Análisis Financiero",
    headerDescription: "Visualización de ratios, KPIs e inteligencia de negocio.",
    metadataTitle: "Análisis Financiero | ERPGrafico",
    subTabs: FINANCES_ANALYSIS_SUB_TABS,
  },
  {
    value: "budgets",
    label: "Control Presupuestario",
    href: "/finances/budgets/list",
    iconName: "target",
    headerTitle: "Control Presupuestario",
    headerDescription: "Gestión de metas presupuestarias y ejecución.",
    metadataTitle: "Control Presupuestario | ERPGrafico",
    subTabs: FINANCES_BUDGETS_SUB_TABS,
  },
  {
    value: "partners",
    label: "Capital y Socios",
    href: "/finances/partners/composition",
    iconName: "users",
    headerTitle: "Capital y Socios",
    headerDescription: "Gestión de composición societaria y distribución de utilidades.",
    metadataTitle: "Capital y Socios | ERPGrafico",
    subTabs: FINANCES_PARTNERS_SUB_TABS,
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de finanzas */
export function getFinancesTab(value: string): NavTabConfig | undefined {
  return findTabConfig(FINANCES_TABS, value)
}

/** Busca sub-tab de Estados Financieros */
export function getFinancesStatementsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(FINANCES_STATEMENTS_SUB_TABS, value)
}

/** Busca sub-tab de Análisis */
export function getFinancesAnalysisSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(FINANCES_ANALYSIS_SUB_TABS, value)
}

/** Busca sub-tab de Presupuestos */
export function getFinancesBudgetsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(FINANCES_BUDGETS_SUB_TABS, value)
}

/** Busca sub-tab de Capital y Socios */
export function getFinancesPartnersSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(FINANCES_PARTNERS_SUB_TABS, value)
}