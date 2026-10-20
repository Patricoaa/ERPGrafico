import { getEntityIconName, getDomainConceptTitle } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Ventas.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

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
// SUB-TABS: DOCUMENTOS
// ============================================

export const SALES_DTES_SUB_TABS: NavTabConfig[] = [
  {
    value: "orders",
    label: getDomainConceptTitle("ov", true),
    href: "/sales/dtes/orders",
    iconName: getEntityIconName("sales.saleorder") ?? "shopping-cart",
    headerTitle: getDomainConceptTitle("ov", true),
    headerDescription: "Seguimiento de pedidos, estados de fabricación y logística de entregas.",
    metadataTitle: `${getDomainConceptTitle("ov", true)} | ERPGrafico`,
  },
  {
    value: "dtes",
    label: "DTE de Ventas",
    href: "/sales/dtes",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "DTE de Ventas",
    headerDescription: "Gestión de boletas, facturas y notas emitidas a clientes.",
    metadataTitle: "DTE de Ventas | ERPGrafico",
  },
  {
    value: "deliveries",
    label: "Guías de Despacho",
    href: "/sales/dtes/deliveries",
    iconName: "truck",
    headerTitle: "Guías de Despacho",
    headerDescription: "Documentos de entrega a clientes, con su origen en la orden de venta.",
    metadataTitle: "Guías de Despacho | ERPGrafico",
  },
  {
    value: "returns",
    label: "Devoluciones",
    href: "/sales/dtes/returns",
    iconName: "rotate-ccw",
    headerTitle: "Devoluciones",
    headerDescription: "Devoluciones de producto recibidas de clientes y su reingreso a bodega.",
    metadataTitle: "Devoluciones | ERPGrafico",
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
  {
    value: "dtes",
    label: "Documentos DTE",
    href: "/sales/settings/dtes",
    iconName: "settings",
    headerTitle: "Documentos DTE",
    headerDescription: "Tipos de documentos electrónicos habilitados para ser emitidos.",
    metadataTitle: "Documentos DTE | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const SALES_TABS: NavTabConfig[] = [
  {
    value: "dtes",
    label: "Documentos",
    href: "/sales/dtes",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "Documentos",
    headerDescription: "Órdenes, DTE, entregas y devoluciones del ciclo comercial de venta.",
    metadataTitle: "Documentos | ERPGrafico",
    subTabs: SALES_DTES_SUB_TABS,
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
    headerDescription: "Políticas de crédito, parámetros del POS y documentos electrónicos.",
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

/** Busca sub-tab de POS */
export function getSalesPosSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_POS_SUB_TABS, value)
}

/** Busca sub-tab de Créditos/Cartera */
export function getSalesCreditsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_CREDITS_SUB_TABS, value)
}

/** Busca sub-tab de Documentos (DTE) */
export function getSalesDtesSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_DTES_SUB_TABS, value)
}

/** Busca sub-tab de Configuración */
export function getSalesConfigSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(SALES_CONFIG_SUB_TABS, value)
}