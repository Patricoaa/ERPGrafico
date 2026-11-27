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
  {
    value: "rcv",
    label: "RCV / SII",
    href: "/accounting/settings/rcv",
    iconName: "file-spreadsheet",
    headerTitle: "RCV / SII",
    headerDescription: "Credenciales del SII, API keys de SimpleAPI y programación de la importación del RCV.",
    metadataTitle: "RCV / SII | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: REGISTRO DE COMPRAS Y VENTAS
// ============================================

export const RCV_SUB_TABS: NavTabConfig[] = [
  {
    value: "purchases",
    label: "Compras",
    href: "/accounting/rcv/purchases",
    iconName: "shopping-cart",
    headerTitle: "Registro de Compras",
    headerDescription: "Documentos recibidos según el Registro de Compras del SII.",
    metadataTitle: "Registro de Compras | ERPGrafico",
  },
  {
    value: "sales",
    label: "Ventas",
    href: "/accounting/rcv/sales",
    iconName: "receipt",
    headerTitle: "Registro de Ventas",
    headerDescription: "Documentos emitidos según el Registro de Ventas del SII.",
    metadataTitle: "Registro de Ventas | ERPGrafico",
  },
  {
    value: "imports",
    label: "Importaciones",
    href: "/accounting/rcv/imports",
    iconName: "download",
    headerTitle: "Importaciones RCV",
    headerDescription: "Historial de importaciones del RCV desde el SII.",
    metadataTitle: "Importaciones RCV | ERPGrafico",
  },
  {
    value: "cuadre",
    label: "Cuadre",
    href: "/accounting/rcv/cuadre",
    iconName: "scale",
    headerTitle: "Cuadre",
    headerDescription: "Cada documento del ERP con sus pagos TUU y su registro en el SII.",
    metadataTitle: "Cuadre | ERPGrafico",
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
    value: "rcv",
    label: "Registro de Compras y Ventas",
    href: "/accounting/rcv",
    iconName: "file-spreadsheet",
    headerTitle: "Registro de Compras y Ventas",
    headerDescription: "Documentos tributarios importados desde el SII y su historial de importaciones.",
    metadataTitle: "Registro de Compras y Ventas | ERPGrafico",
    subTabs: RCV_SUB_TABS,
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

/** Busca sub-tab del Registro de Compras y Ventas */
export function getRcvSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(RCV_SUB_TABS, value)
}

/** Pestaña y sub-pestaña activas de Contabilidad según la ruta (`/accounting/<tab>/<sub>`). */
export function resolveAccountingNav(pathname: string): { activeValue: string; subActiveValue: string | undefined } {
  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "ledger"
  if (currentSegment === "settings") return { activeValue: "config", subActiveValue: segments[2] || "vat-rates" }
  if (currentSegment === "rcv") return { activeValue: "rcv", subActiveValue: segments[2] || "purchases" }
  return { activeValue: currentSegment, subActiveValue: undefined }
}

/** Busca sub-tab de Configuración */
export function getAccountingConfigSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(ACCOUNTING_CONFIG_SUB_TABS, value)
}