import { getEntityIconName, getDomainConceptTitle } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Ventas.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: ÓRDENES
// ============================================

export const SALES_ORDERS_SUB_TABS: NavTabConfig[] = [
  {
    value: "orders",
    label: getDomainConceptTitle("ov", true),
    href: "/sales/orders",
    iconName: getEntityIconName("sales.saleorder") ?? "shopping-cart",
    headerTitle: getDomainConceptTitle("ov", true),
    headerDescription: "Seguimiento de pedidos, estados de fabricación y logística de entregas.",
    metadataTitle: `${getDomainConceptTitle("ov", true)} | ERPGrafico`,
  },
  {
    value: "notes",
    label: "Notas de Crédito y Débito",
    href: "/sales/orders/notes",
    iconName: "file-text",
    headerTitle: "Notas de Crédito y Débito",
    headerDescription: "Gestión de devoluciones, correcciones de facturación y ajustes de cuenta.",
    metadataTitle: "Notas de Crédito y Débito | ERPGrafico",
  },
  {
    value: "deliveries",
    label: "Guías de Despacho",
    href: "/sales/orders/deliveries",
    iconName: "truck",
    headerTitle: "Guías de Despacho",
    headerDescription: "Historial de envíos y entregas a clientes, incluyendo notas de débito.",
    metadataTitle: "Guías de Despacho | ERPGrafico",
  },
  {
    value: "returns",
    label: "Devoluciones",
    href: "/sales/returns",
    iconName: "rotate-ccw",
    headerTitle: "Devoluciones",
    headerDescription: "Gestión de devoluciones de productos y notas de crédito asociadas.",
    metadataTitle: "Devoluciones | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: POS
// ============================================

export const SALES_POS_SUB_TABS: NavTabConfig[] = [
  {
    value: "cajas",
    label: "Puntos de Venta",
    href: "/sales/pos/cajas",
    iconName: "banknote",
    headerTitle: "Puntos de Venta",
    headerDescription: "Administre los puntos de venta y sus métodos de pago autorizados.",
    metadataTitle: "Puntos de Venta | ERPGrafico",
  },
  {
    value: "sessions",
    label: "Sesiones POS",
    href: "/sales/sessions",
    iconName: "list",
    headerTitle: "Sesiones POS",
    headerDescription: "Historial de aperturas y cierres de sesión.",
    metadataTitle: "Sesiones POS | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: CARTERA (CRÉDITOS)
// ============================================

export const SALES_CREDITS_SUB_TABS: NavTabConfig[] = [
  {
    value: "portfolio",
    label: "Cartera de Créditos",
    href: "/sales/credits/portfolio",
    iconName: "pie-chart",
    headerTitle: "Cartera de Créditos",
    headerDescription: "Saldo por cliente, clasificación por antigüedad y estado de cobro.",
    metadataTitle: "Cartera de Créditos | ERPGrafico",
  },
  {
    value: "history",
    label: "Historial de Asignaciones",
    href: "/sales/credits/history",
    iconName: "history",
    headerTitle: "Historial de Asignaciones",
    headerDescription: "Registro global de créditos asignados a clientes.",
    metadataTitle: "Historial de Asignaciones | ERPGrafico",
  },
  {
    value: "blacklist",
    label: "Lista Negra",
    href: "/sales/credits/blacklist",
    iconName: "user-x",
    headerTitle: "Lista Negra",
    headerDescription: "Clientes con historial de impago o riesgo crediticio.",
    metadataTitle: "Lista Negra | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: CONFIGURACIÓN
// ============================================

export const SALES_CONFIG_SUB_TABS: NavTabConfig[] = [
  {
    value: "credit",
    label: "Configuración de Crédito",
    href: "/sales/settings/credit",
    iconName: "credit-card",
    headerTitle: "Configuración de Crédito",
    headerDescription: "Políticas de crédito, límites y condiciones de pago.",
    metadataTitle: "Configuración de Crédito | ERPGrafico",
  },
  {
    value: "config-pos",
    label: "Configuración de POS",
    href: "/sales/settings/config-pos",
    iconName: "settings",
    headerTitle: "Configuración de POS",
    headerDescription: "Parámetros de puntos de venta, terminales y métodos de pago.",
    metadataTitle: "Configuración de POS | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const SALES_TABS: NavTabConfig[] = [
  {
    value: "orders",
    label: getDomainConceptTitle("ov", true),
    href: "/sales/orders",
    iconName: getEntityIconName("sales.saleorder") ?? "shopping-cart",
    headerTitle: getDomainConceptTitle("ov", true),
    headerDescription: "Seguimiento de pedidos, estados de fabricación y logística de entregas.",
    metadataTitle: `${getDomainConceptTitle("ov", true)} | ERPGrafico`,
    subTabs: SALES_ORDERS_SUB_TABS,
  },
  {
    value: "pos",
    label: "Puntos de Venta",
    href: "/sales/pos/cajas",
    iconName: "banknote",
    headerTitle: "Puntos de Venta",
    headerDescription: "Administre los puntos de venta y sus métodos de pago autorizados.",
    metadataTitle: "Puntos de Venta | ERPGrafico",
    subTabs: SALES_POS_SUB_TABS,
  },
  {
    value: "credits",
    label: "Cartera de Créditos",
    href: "/sales/credits/portfolio",
    iconName: "pie-chart",
    headerTitle: "Cartera de Créditos",
    headerDescription: "Saldo por cliente, clasificación por antigüedad y estado de cobro.",
    metadataTitle: "Cartera de Créditos | ERPGrafico",
    subTabs: SALES_CREDITS_SUB_TABS,
  },
  {
    value: "config",
    label: "Configuración de Ventas",
    href: "/sales/settings",
    iconName: "settings",
    headerTitle: "Configuración de Ventas",
    headerDescription: "Gestione las políticas de crédito y parámetros del POS.",
    metadataTitle: "Configuración de Ventas | ERPGrafico",
    subTabs: SALES_CONFIG_SUB_TABS,
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de ventas */
export function getSalesTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_TABS, value)
}

/** Busca sub-tab de Órdenes */
export function getSalesOrdersSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_ORDERS_SUB_TABS, value)
}

/** Busca sub-tab de POS */
export function getSalesPosSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_POS_SUB_TABS, value)
}

/** Busca sub-tab de Créditos/Cartera */
export function getSalesCreditsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_CREDITS_SUB_TABS, value)
}

/** Busca sub-tab de Configuración */
export function getSalesConfigSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_CONFIG_SUB_TABS, value)
}

/** Busca sub-tab de Devoluciones (bajo Órdenes) */
export function getSalesReturnsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_ORDERS_SUB_TABS, value)
}