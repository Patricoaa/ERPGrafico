import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Inventario.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: PRODUCTOS
// ============================================

export const INVENTORY_PRODUCTS_SUB_TABS: NavTabConfig[] = [
  {
    value: "products",
    label: "Catálogo de Productos",
    href: "/inventory/products",
    iconName: getEntityIconName("inventory.product") ?? "package",
    headerTitle: "Catálogo de Productos",
    headerDescription: "Gestión de bienes físicos, servicios y consumibles.",
    metadataTitle: "Catálogo de Productos | ERPGrafico",
  },
  {
    value: "uoms",
    label: "Unidades de Medida",
    href: "/inventory/products/uoms/units",
    iconName: getEntityIconName("inventory.uom") ?? "ruler",
    headerTitle: "Unidades de Medida",
    headerDescription: "Configuración de métricas y factores de conversión estándar.",
    metadataTitle: "Unidades de Medida | ERPGrafico",
  },
  {
    value: "pricing-rules",
    label: "Reglas de Precios",
    href: "/inventory/products/pricing-rules",
    iconName: getEntityIconName("inventory.pricingrule") ?? "tag",
    headerTitle: "Reglas de Precios",
    headerDescription: "Políticas de tarifas, descuentos y márgenes por cliente o volumen.",
    metadataTitle: "Reglas de Precios | ERPGrafico",
  },
  {
    value: "attributes",
    label: "Atributos de Variantes",
    href: "/inventory/products/attributes",
    iconName: getEntityIconName("inventory.attribute") ?? "list",
    headerTitle: "Atributos de Variantes",
    headerDescription: "Propiedades variables: tallas, colores, materiales y más.",
    metadataTitle: "Atributos de Variantes | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: REPORTES
// ============================================

export const INVENTORY_REPORTS_SUB_TABS: NavTabConfig[] = [
  // Moved to Operations
]

// ============================================
// SUB-TABS: OPERACIONES
// ============================================

export const INVENTORY_OPERATIONS_SUB_TABS: NavTabConfig[] = [
  {
    value: "warehouses",
    label: "Almacenes y Ubicaciones",
    href: "/inventory/operations/warehouses",
    iconName: getEntityIconName("inventory.warehouse") ?? "warehouse",
    headerTitle: "Almacenes y Ubicaciones",
    headerDescription: "Estructura física y lógica para el almacenamiento de mercadería.",
    metadataTitle: "Almacenes y Ubicaciones | ERPGrafico",
  },
  {
    value: "manual-operations",
    label: "Ajustes y Transferencias Manuales",
    href: "/inventory/operations/manual-operations",
    iconName: "file-text",
    headerTitle: "Ajustes y Transferencias Manuales",
    headerDescription: "Ajustes de inventario, transferencias entre bodegas, producción manual y aportes de socios.",
    metadataTitle: "Ajustes y Transferencias Manuales | ERPGrafico",
  },
  {
    value: "counts",
    label: "Conteo de Inventario",
    href: "/inventory/operations/counts",
    iconName: "clipboard-check",
    headerTitle: "Conteo de Inventario",
    headerDescription: "Conteo rápido de stock teórico vs real y generación de ajustes.",
    metadataTitle: "Conteo de Inventario | ERPGrafico",
  },
  {
    value: "stock",
    label: "Existencias",
    href: "/inventory/operations/stock",
    iconName: "package",
    headerTitle: "Existencias",
    headerDescription: "Estado actual del inventario por almacén, valorizado en tiempo real.",
    metadataTitle: "Existencias | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: CONFIGURACIÓN
// ============================================

export const INVENTORY_CONFIG_SUB_TABS: NavTabConfig[] = [
  {
    value: "valuation",
    label: "Valorización",
    href: "/inventory/settings",
    iconName: "package",
    headerTitle: "Valorización",
    headerDescription: "Métodos de valoración de inventario y configuración de costos.",
    metadataTitle: "Valorización | ERPGrafico",
  },
  {
    value: "categories",
    label: "Categorías de Productos",
    href: "/inventory/settings/categories",
    iconName: getEntityIconName("inventory.category") ?? "folder-tree",
    headerTitle: "Categorías de Productos",
    headerDescription: "Organización y clasificación jerárquica del catálogo general.",
    metadataTitle: "Categorías de Productos | ERPGrafico",
  },
  {
    value: "measure-categories",
    label: "Categorías de Medidas",
    href: "/inventory/settings/measure-categories",
    iconName: getEntityIconName("inventory.uomcategory") ?? "scale",
    headerTitle: "Categorías de Medidas",
    headerDescription: "Clasificación de magnitudes compatibles (peso, volumen, longitud).",
    metadataTitle: "Categorías de Medidas | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const INVENTORY_TABS: NavTabConfig[] = [
  {
    value: "products",
    label: "Catálogo de Productos",
    href: "/inventory/products",
    iconName: getEntityIconName("inventory.product") ?? "package",
    headerTitle: "Catálogo de Productos",
    headerDescription: "Gestión de bienes físicos, servicios y consumibles.",
    metadataTitle: "Catálogo de Productos | ERPGrafico",
    subTabs: INVENTORY_PRODUCTS_SUB_TABS,
  },
  {
    value: "operations",
    label: "Operaciones",
    href: "/inventory/operations/warehouses",
    iconName: "activity",
    headerTitle: "Operaciones",
    headerDescription: "Almacenes, recepciones, entregas, ajustes y conteos.",
    metadataTitle: "Operaciones | ERPGrafico",
    subTabs: INVENTORY_OPERATIONS_SUB_TABS,
  },
  {
    value: "config",
    label: "Configuración de Inventario",
    href: "/inventory/settings",
    iconName: "settings",
    headerTitle: "Configuración de Inventario",
    headerDescription: "Parámetros generales del módulo de inventario.",
    metadataTitle: "Configuración de Inventario | ERPGrafico",
    subTabs: INVENTORY_CONFIG_SUB_TABS,
  },
]

// ============================================
// HELPERS LOCALES
// ============================================

import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de inventario */
export function getInventoryTab(value: string): NavTabConfig | undefined {
  return findTabConfig(INVENTORY_TABS, value)
}

/** Busca sub-tab de Productos */
export function getInventoryProductsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(INVENTORY_PRODUCTS_SUB_TABS, value)
}

/** Busca sub-tab de Reportes */
export function getInventoryReportsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(INVENTORY_REPORTS_SUB_TABS, value)
}

/** Busca sub-tab de Operaciones */
export function getInventoryOperationsSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(INVENTORY_OPERATIONS_SUB_TABS, value)
}

/** Busca sub-tab de Configuración */
export function getInventoryConfigSubTab(value: string): NavTabConfig | undefined {
  return findSubTabConfig(INVENTORY_TABS, "config", value)
}