import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Compras.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

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