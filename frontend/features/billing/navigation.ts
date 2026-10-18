import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Facturación.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: CONFIGURACIÓN
// ============================================

export const BILLING_CONFIG_SUB_TABS: NavTabConfig[] = [
  {
    value: "dtes",
    label: "Documentos",
    href: "/billing/settings/dtes",
    iconName: "file-text",
    headerTitle: "Documentos",
    headerDescription: "Configuración de tipos de documentos electrónicos (DTE), series y rangos.",
    metadataTitle: "Documentos | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const BILLING_TABS: NavTabConfig[] = [
  {
    value: "sales",
    label: "DTE de Ventas",
    href: "/billing/sales",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "DTE de Ventas",
    headerDescription: "Gestión de boletas, facturas y órdenes de venta emitidas a clientes.",
    metadataTitle: "DTE de Ventas | ERPGrafico",
    subTabs: [],
  },
  {
    value: "purchases",
    label: "DTE de Compras",
    href: "/billing/purchases",
    iconName: getEntityIconName("billing.purchaseinvoice") ?? "file-text",
    headerTitle: "DTE de Compras",
    headerDescription: "Recepción y cuadratura de facturas y notas de crédito de proveedores.",
    metadataTitle: "DTE de Compras | ERPGrafico",
    subTabs: [],
  },
  {
    value: "config",
    label: "Configuración de Facturación",
    href: "/billing/settings",
    iconName: "settings",
    headerTitle: "Configuración de Facturación",
    headerDescription: "Gestione los parámetros de documentos electrónicos.",
    metadataTitle: "Configuración de Facturación | ERPGrafico",
    subTabs: BILLING_CONFIG_SUB_TABS,
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de facturación */
export function getBillingTab(value: string): NavTabConfig | undefined {
  return findTabConfig(BILLING_TABS, value)
}

/** Busca sub-tab de Configuración */
export function getBillingConfigSubTab(value: string): NavTabConfig | undefined {
  return findSubTabConfig(BILLING_TABS, "config", value)
}