import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Compras.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: DOCUMENTOS (DTE)
// ============================================

export const PURCHASING_DTES_SUB_TABS: NavTabConfig[] = [
  {
    value: "dtes",
    label: "DTE de Compras",
    href: "/purchasing/dtes",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "DTE de Compras",
    headerDescription: "Recepción y cuadratura de facturas y notas de crédito de proveedores.",
    metadataTitle: "DTE de Compras | ERPGrafico",
  },
  {
    value: "settings",
    label: "Configuración de Documentos",
    href: "/purchasing/dtes/settings",
    iconName: "settings",
    headerTitle: "Configuración de Documentos",
    headerDescription: "Tipos de documentos electrónicos habilitados para ser registrados.",
    metadataTitle: "Configuración de Documentos | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const PURCHASING_TABS: NavTabConfig[] = [
  {
    value: "orders",
    label: "Órdenes de Compra",
    href: "/purchasing/orders",
    iconName: getEntityIconName("purchasing.purchaseorder") ?? "shopping-bag",
    headerTitle: "Órdenes de Compra",
    headerDescription: "Gestión integral de órdenes de compra y recepciones",
    metadataTitle: "Órdenes de Compra | ERPGrafico",
    subTabs: [],
  },
  {
    value: "dtes",
    label: "Documentos",
    href: "/purchasing/dtes",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "Documentos",
    headerDescription: "Facturas y notas de proveedores recibidas, con cuadratura contra recepción.",
    metadataTitle: "Documentos | ERPGrafico",
    subTabs: PURCHASING_DTES_SUB_TABS,
  },
  {
    value: "subscriptions",
    label: "Suscripciones",
    href: "/purchasing/subscriptions",
    iconName: "calendar-clock",
    headerTitle: "Suscripciones",
    headerDescription: "Gestión de servicios recurrentes, contratos y facturación automática.",
    metadataTitle: "Suscripciones | ERPGrafico",
    subTabs: [],
  },
  {
    value: "notes",
    label: "Notas de Crédito y Débito",
    href: "/purchasing/notes",
    iconName: "file-text",
    headerTitle: "Notas de Crédito y Débito",
    headerDescription: "Gestión de notas de crédito y débito de proveedores",
    metadataTitle: "Notas de Crédito y Débito | ERPGrafico",
    subTabs: [],
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de compras */
export function getPurchasingTab(value: string): NavTabConfig | undefined {
  return findTabConfig(PURCHASING_TABS, value)
}

/** Busca sub-tab de Documentos (DTE) */
export function getPurchasingDtesSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(PURCHASING_DTES_SUB_TABS, value)
}