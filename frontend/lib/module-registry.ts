import { Home, Package, type LucideIcon } from "lucide-react"
import { getEntityIcon, getEntityIconName } from "@/lib/entity-registry"

export interface ModuleConfig {
  id: string
  label: string
  icon: LucideIcon
  iconName: string
  primaryEntityLabel: string | null
  permission: string | null
  defaultUrl: string
}

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  dashboard:   { id: "dashboard",   label: "Inicio",        icon: Home,          iconName: "home",          primaryEntityLabel: null,                                    permission: null,                                         defaultUrl: "/" },
  accounting:  { id: "accounting",  label: "Contabilidad",  icon: Home,          iconName: "home",          primaryEntityLabel: 'accounting.account',                   permission: "accounting.view_dashboard_accounting",       defaultUrl: "/accounting/ledger?view=list" },
  billing:     { id: "billing",     label: "Facturación",   icon: Home,          iconName: "home",           primaryEntityLabel: 'billing.invoice',                      permission: "billing.view_dashboard_billing",             defaultUrl: "/billing/sales?view=card" },
  sales:       { id: "sales",       label: "Ventas",        icon: Home,          iconName: "home",           primaryEntityLabel: 'sales.saleorder',                      permission: "sales.view_dashboard_sales",                defaultUrl: "/sales/orders?view=card" },
  contacts:    { id: "contacts",    label: "Contactos",     icon: Home,          iconName: "home",          primaryEntityLabel: 'contacts.contact',                     permission: null,                                         defaultUrl: "/contacts?view=list" },
  inventory:   { id: "inventory",   label: "Inventario",    icon: Package,        iconName: "package",        primaryEntityLabel: 'inventory.product',                    permission: "inventory.view_dashboard_inventory",        defaultUrl: "/inventory/products?view=list" },
  production:  { id: "production",  label: "Producción",    icon: Home,          iconName: "home",           primaryEntityLabel: 'production.workorder',                  permission: "production.view_dashboard_production",       defaultUrl: "/production/orders?view=list" },
  treasury:    { id: "treasury",    label: "Tesorería",     icon: Home,          iconName: "home",           primaryEntityLabel: 'treasury.treasurymovement',            permission: "treasury.view_dashboard_treasury",          defaultUrl: "/treasury/operaciones/movements?view=card" },
  purchasing:  { id: "purchasing",  label: "Compras",       icon: Home,          iconName: "home",           primaryEntityLabel: 'purchasing.purchaseorder',             permission: "purchasing.view_dashboard_purchasing",      defaultUrl: "/purchasing/orders?view=card" },
  finances:    { id: "finances",    label: "Finanzas",      icon: Home,          iconName: "home",           primaryEntityLabel: 'finance.bankjournal',                  permission: "finances.view_dashboard_finances",          defaultUrl: "/finances/statements/bs" },
  hr:          { id: "hr",          label: "RRHH",          icon: Home,          iconName: "home",           primaryEntityLabel: 'hr.employee',                          permission: "hr.view_dashboard_hr",                     defaultUrl: "/hr/employees?view=list" },
} as const

export const MODULE_ORDER = ["dashboard", "accounting", "billing", "sales", "contacts", "inventory", "production", "treasury", "purchasing", "finances", "hr"] as const

export function getModuleConfig(id: string): ModuleConfig | undefined {
  return MODULE_REGISTRY[id]
}

export function getModuleDefaultUrl(id: string): string {
  return MODULE_REGISTRY[id]?.defaultUrl ?? "/"
}

export function getModuleIcon(id: string): LucideIcon {
  const mod = MODULE_REGISTRY[id]
  if (mod?.primaryEntityLabel) return getEntityIcon(mod.primaryEntityLabel)
  return mod?.icon ?? Package
}

export function getModuleIconName(id: string): string {
  const mod = MODULE_REGISTRY[id]
  if (mod?.primaryEntityLabel) return getEntityIconName(mod.primaryEntityLabel)
  return mod?.iconName ?? 'package'
}
