import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Compras.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 *
 * ADR-0090: un solo tab de nivel 1 "Documentos" con cada lista sobre su propia
 * entidad (OC, DTE recibidas, recepciones, devoluciones), y un tab de
 * Configuración de Compras donde vive la configuración DTE.
 */

// ============================================
// SUB-TABS: DOCUMENTOS
// ============================================

export const PURCHASING_DTES_SUB_TABS: NavTabConfig[] = [
  {
    value: "orders",
    label: "Órdenes de Compra",
    href: "/purchasing/dtes/orders",
    iconName: getEntityIconName("purchasing.purchaseorder") ?? "shopping-bag",
    headerTitle: "Órdenes de Compra",
    headerDescription: "Gestión integral de órdenes de compra y su ciclo de recepción.",
    metadataTitle: "Órdenes de Compra | ERPGrafico",
  },
  {
    value: "dtes",
    label: "Documentos Tributarios",
    href: "/purchasing/dtes",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "Documentos Tributarios",
    headerDescription: "Recepción y cuadratura de facturas y notas de crédito de proveedores.",
    metadataTitle: "Documentos Tributarios | ERPGrafico",
  },
  {
    value: "fulfillment",
    label: "Recepciones y Devoluciones",
    href: "/purchasing/dtes/fulfillment",
    iconName: "package-check",
    headerTitle: "Recepciones y Devoluciones",
    headerDescription: "Recepciones de mercadería, devoluciones a proveedores y su trazabilidad de stock.",
    metadataTitle: "Recepciones y Devoluciones | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: CONFIGURACIÓN
// ============================================

export const PURCHASING_CONFIG_SUB_TABS: NavTabConfig[] = [
  {
    value: "dtes",
    label: "Documentos Tributarios",
    href: "/purchasing/settings/dtes",
    iconName: "settings",
    headerTitle: "Documentos Tributarios",
    headerDescription: "Tipos de documentos electrónicos habilitados para ser registrados.",
    metadataTitle: "Documentos Tributarios | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const PURCHASING_TABS: NavTabConfig[] = [
  {
    value: "dtes",
    label: "Documentos",
    href: "/purchasing/docs",
    iconName: getEntityIconName("billing.invoice") ?? "file-text",
    headerTitle: "Documentos",
    headerDescription: "Órdenes, DTE, recepciones y devoluciones del ciclo de abastecimiento.",
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
    value: "config",
    label: "Configuración",
    href: "/purchasing/settings",
    iconName: "settings",
    headerTitle: "Configuración",
    headerDescription: "Parámetros de abastecimiento y documentos electrónicos de proveedores.",
    metadataTitle: "Configuración | ERPGrafico",
    subTabs: PURCHASING_CONFIG_SUB_TABS,
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

/** Busca sub-tab de Documentos */
export function getPurchasingDtesSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(PURCHASING_DTES_SUB_TABS, value)
}

/** Busca sub-tab de Configuración de Compras */
export function getPurchasingConfigSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(PURCHASING_CONFIG_SUB_TABS, value)
}
