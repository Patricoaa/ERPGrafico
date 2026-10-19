import { getEntityIconName } from "@/lib/entity-registry"
import type { NavTabConfig } from "@/lib/navigation-types"

/**
 * Configuración canónica de navegación para Tesorería.
 * Single Source of Truth para: Riel (label), TopBar (headerTitle/headerDescription), SEO (metadataTitle).
 * REGLA: label === headerTitle (consistencia visual Riel = TopBar)
 */

// ============================================
// SUB-TABS: OPERACIONES
// ============================================

export const OPERACIONES_SUB_TABS: NavTabConfig[] = [
  {
    value: "movements",
    label: "Movimientos de Tesorería",
    href: "/treasury/operaciones/movements",
    iconName: getEntityIconName("treasury.treasurymovement") ?? "banknote",
    headerTitle: "Movimientos de Tesorería",
    headerDescription: "Registro histórico de ingresos, egresos y traslados de fondos.",
    metadataTitle: "Movimientos de Tesorería | ERPGrafico",
  },
  {
    value: "accounts",
    label: "Cuentas de Tesorería",
    href: "/treasury/operaciones/accounts",
    iconName: getEntityIconName("treasury.treasuryaccount") ?? "wallet",
    headerTitle: "Cuentas de Tesorería",
    headerDescription: "Registre y configure sus cuentas bancarias y de efectivo.",
    metadataTitle: "Cuentas de Tesorería | ERPGrafico",
  },
  {
    value: "methods",
    label: "Métodos de Pago",
    href: "/treasury/operaciones/methods",
    iconName: getEntityIconName("treasury.paymentmethod") ?? "credit-card",
    headerTitle: "Métodos de Pago",
    headerDescription: "Configure los medios de pago aceptados y sus cuentas vinculadas.",
    metadataTitle: "Métodos de Pago | ERPGrafico",
  },
  {
    value: "checks",
    label: "Gestión de Cheques",
    href: "/treasury/operaciones/checks",
    iconName: getEntityIconName("treasury.check") ?? "check-square",
    headerTitle: "Gestión de Cheques",
    headerDescription: "Registre, deposite y gestione cheques recibidos y propios.",
    metadataTitle: "Gestión de Cheques | ERPGrafico",
  },
]

// ============================================
// SUB-TABS: TERMINAL DE COBRO
// ============================================

export const TERMINAL_COBRO_SUB_TABS: NavTabConfig[] = [
  {
    value: "providers",
    label: "Proveedores de Pago",
    href: "/treasury/terminal-cobro/providers",
    iconName: getEntityIconName("treasury.terminalprovider") ?? "building-2",
    headerTitle: "Proveedores de Pago",
    headerDescription: "Configuración de cuentas y comisiones por proveedor (TUU, Transbank, etc.).",
    metadataTitle: "Proveedores de Pago | ERPGrafico",
  },
  {
    value: "devices",
    label: "Dispositivos de Pago",
    href: "/treasury/terminal-cobro/devices",
    iconName: getEntityIconName("treasury.terminaldevice") ?? "cpu",
    headerTitle: "Dispositivos de Pago",
    headerDescription: "Gestione los terminales físicos de cobro y su vinculación con proveedores.",
    metadataTitle: "Dispositivos de Pago | ERPGrafico",
  },
  {
    value: "batches",
    label: "Lotes de Pago",
    href: "/treasury/terminal-cobro/batches",
    iconName: getEntityIconName("treasury.terminalbatch") ?? "file-text",
    headerTitle: "Lotes de Pago",
    headerDescription: "Gestión de cierres diarios y liquidaciones de tarjetas.",
    metadataTitle: "Lotes de Pago | ERPGrafico",
  },
]

// ============================================
// SUB-VISTAS: BANK CENTER (por banco)
// ============================================

export const BANK_SUB_VIEWS: NavTabConfig[] = [
  {
    value: "overview",
    label: "Resumen del Banco",
    href: "/overview",
    iconName: "bar-chart-3",
    headerTitle: "Resumen del Banco",
    headerDescription: "Vista general de cuentas, productos y vencimientos.",
    metadataTitle: "Resumen del Banco | ERPGrafico",
  },
  {
    value: "movements",
    label: "Movimientos Bancarios",
    href: "/movements",
    iconName: "arrow-right-left",
    headerTitle: "Movimientos Bancarios",
    headerDescription: "Histórico de movimientos de la cuenta bancaria.",
    metadataTitle: "Movimientos Bancarios | ERPGrafico",
  },
  {
    value: "checks",
    label: "Cheques del Banco",
    href: "/checks",
    iconName: "check-square",
    headerTitle: "Cheques del Banco",
    headerDescription: "Cheques emitidos y recibidos vinculados a este banco.",
    metadataTitle: "Cheques del Banco | ERPGrafico",
  },
  {
    value: "loans",
    label: "Préstamos Bancarios",
    href: "/loans",
    iconName: "landmark",
    headerTitle: "Préstamos Bancarios",
    headerDescription: "Préstamos y líneas de crédito con esta entidad.",
    metadataTitle: "Préstamos Bancarios | ERPGrafico",
  },
  {
    value: "cards",
    label: "Tarjetas de Crédito",
    href: "/cards/unbilled",
    iconName: "credit-card",
    headerTitle: "Tarjetas de Crédito",
    headerDescription: "Cargos no facturados y estados de cuenta.",
    metadataTitle: "Tarjetas de Crédito | ERPGrafico",
  },
  {
    value: "reconciliation",
    label: "Conciliación Bancaria",
    href: "/reconciliation",
    iconName: "git-compare",
    headerTitle: "Conciliación Bancaria",
    headerDescription: "Conciliación de movimientos contra cartolas del banco.",
    metadataTitle: "Conciliación Bancaria | ERPGrafico",
  },
]

// ============================================
// SUB-VISTAS AGREGADAS: BANK CENTER (todos los bancos)
// ============================================
// Rutas estáticas bajo /treasury/bank-center (preceden a [bankId], que sólo
// captura ids numéricos). No incluyen "overview": la vista consolidada es la
// propia lista de bancos.

export const ALL_BANKS_SUB_VIEWS: NavTabConfig[] = [
  {
    value: "movements",
    label: "Movimientos Bancarios",
    href: "/treasury/bank-center/movements",
    iconName: "arrow-right-left",
    headerTitle: "Movimientos Bancarios",
    headerDescription: "Movimientos de todas las cuentas bancarias.",
    metadataTitle: "Movimientos Bancarios | ERPGrafico",
  },
  {
    value: "checks",
    label: "Cheques",
    href: "/treasury/bank-center/checks",
    iconName: "check-square",
    headerTitle: "Cheques",
    headerDescription: "Cheques vinculados a todos los bancos.",
    metadataTitle: "Cheques | ERPGrafico",
  },
  {
    value: "loans",
    label: "Préstamos Bancarios",
    href: "/treasury/bank-center/loans",
    iconName: "landmark",
    headerTitle: "Préstamos Bancarios",
    headerDescription: "Préstamos y líneas de crédito de todos los bancos.",
    metadataTitle: "Préstamos Bancarios | ERPGrafico",
  },
  {
    value: "cards",
    label: "Tarjetas de Crédito",
    href: "/treasury/bank-center/cards/unbilled",
    iconName: "credit-card",
    headerTitle: "Tarjetas de Crédito",
    headerDescription: "Cargos no facturados y estados de cuenta de todas las tarjetas.",
    metadataTitle: "Tarjetas de Crédito | ERPGrafico",
  },
  {
    value: "reconciliation",
    label: "Conciliación Bancaria",
    href: "/treasury/bank-center/reconciliation",
    iconName: "git-compare",
    headerTitle: "Conciliación Bancaria",
    headerDescription: "Conciliación de cartolas de todos los bancos.",
    metadataTitle: "Conciliación Bancaria | ERPGrafico",
  },
]

// ============================================
// TABS PRINCIPALES (nivel 1)
// ============================================

export const TREASURY_TABS: NavTabConfig[] = [
  {
    value: "operaciones",
    label: "Operaciones de Tesorería",
    href: "/treasury/operaciones/movements",
    iconName: getEntityIconName("treasury.treasurymovement") ?? "banknote",
    headerTitle: "Operaciones de Tesorería",
    headerDescription: "Movimientos, cheques, cuentas de tesorería y métodos de pago.",
    metadataTitle: "Operaciones de Tesorería | ERPGrafico",
    subTabs: OPERACIONES_SUB_TABS,
  },
  {
    value: "bank-center",
    label: "Centro de Bancos",
    href: "/treasury/bank-center",
    iconName: "landmark",
    headerTitle: "Centro de Bancos",
    headerDescription: "Vista consolidada de todos sus bancos, productos financieros y vencimientos.",
    metadataTitle: "Centro de Bancos | ERPGrafico",
    subTabs: [], // Se pobla dinámicamente en buildBankSubTabs
  },
  {
    value: "terminal-cobro",
    label: "Terminal de Cobro",
    href: "/treasury/terminal-cobro/providers",
    iconName: "credit-card",
    headerTitle: "Terminal de Cobro",
    headerDescription: "Proveedores, dispositivos y liquidaciones de pagos con tarjeta.",
    metadataTitle: "Terminal de Cobro | ERPGrafico",
    subTabs: TERMINAL_COBRO_SUB_TABS,
  },
]

/**
 * Construye los sub-tabs del Bank Center: tab "Todos" (con las sub-vistas
 * agregadas) + un tab por cada banco activo (con sus sub-vistas navegables).
 */
export function buildBankSubTabs(
  banks: { id: number; is_active: boolean; name: string }[]
): NavTabConfig[] {
  const allTab: NavTabConfig = {
    value: "all",
    label: "Centro de Bancos",
    href: "/treasury/bank-center",
    iconName: "layout-grid",
    headerTitle: "Centro de Bancos",
    headerDescription: "Vista consolidada de todos sus bancos, productos financieros y vencimientos.",
    metadataTitle: "Centro de Bancos | ERPGrafico",
    subTabs: ALL_BANKS_SUB_VIEWS,
  }

  const bankTabs: NavTabConfig[] = banks
    .filter((b) => b.is_active)
    .map((bank) => ({
      value: `bank-${bank.id}`,
      label: bank.name,
      iconName: "landmark",
      href: `/treasury/bank-center/${bank.id}/overview`,
      headerTitle: bank.name,
      headerDescription: "Vista unificada: cuentas, productos financieros y conciliación del banco.",
      metadataTitle: `${bank.name} | ERPGrafico`,
      subTabs: BANK_SUB_VIEWS.map((sv) => ({
        ...sv,
        href: `/treasury/bank-center/${bank.id}${sv.href}`,
      })),
    }))

  return [allTab, ...bankTabs]
}

// ============================================
// ÁRBOL DE NAVEGACIÓN DEL RIEL (fuente única)
// ============================================

/** Nodo de navegación del riel (shape que consume `HeaderProvider`). */
export interface TreasuryNavTab {
  value: string
  label: string
  href: string
  iconName?: string
  subTabs?: TreasuryNavTab[]
}

/** Convierte un `NavTabConfig` canónico al shape del riel, preservando anidamiento. */
function toNavTab(tab: NavTabConfig): TreasuryNavTab {
  return {
    value: tab.value,
    label: tab.label,
    href: tab.href,
    iconName: tab.iconName,
    subTabs: tab.subTabs?.map(toNavTab),
  }
}

/**
 * Árbol de navegación completo de Tesorería para el riel (ADR-0079).
 *
 * Fuente única de verdad para `TreasuryHeader` (layout) y `BankPageHeader`
 * (página de banco): sin esto, un header podía aplanar u omitir los `subTabs`
 * de cada banco y dejar sus sub-vistas fuera del riel.
 */
export function buildTreasuryTabs(
  banks: { id: number; is_active: boolean; name: string }[]
): TreasuryNavTab[] {
  const bankSubTabs = buildBankSubTabs(banks)
  return TREASURY_TABS.map((tab) => {
    const node = toNavTab(tab)
    if (tab.value === "bank-center") node.subTabs = bankSubTabs.map(toNavTab)
    return node
  })
}

// ============================================
// HELPERS LOCALES (wrappers tipados)
// ============================================

import { findTabConfig, findSubTabConfig } from "@/lib/navigation-helpers"

/** Busca tab principal de tesorería */
export function getTreasuryTab(value: string): NavTabConfig | undefined {
  return findTabConfig(TREASURY_TABS, value)
}

/** Busca sub-tab de Operaciones */
export function getOperacionesSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(OPERACIONES_SUB_TABS, value)
}

/** Busca sub-tab de Terminal de Cobro */
export function getTerminalCobroSubTab(value: string): NavTabConfig | undefined {
  return findTabConfig(TERMINAL_COBRO_SUB_TABS, value)
}

/** Busca sub-vista de banco (dentro de bankTabs dinámicos) */
export function getBankSubView(bankTabs: NavTabConfig[], bankValue: string, subValue: string): NavTabConfig | undefined {
  const bankTab = bankTabs.find((t) => t.value === bankValue)
  if (!bankTab?.subTabs) return undefined
  return findTabConfig(bankTab.subTabs, subValue)
}