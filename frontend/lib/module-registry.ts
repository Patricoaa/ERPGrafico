import { Home, Package, Wallet, type LucideIcon } from "lucide-react"
import { getEntityIcon, getEntityIconName } from "@/lib/entity-registry"

export interface ModuleConfig {
  id: string
  label: string
  icon: LucideIcon
  iconName: string
  primaryEntityLabel: string | null
  permission: string | null
  defaultUrl: string
  /** Título en TopBar/PageHeader para el módulo (ej: "Tesorería") */
  headerTitle: string
  /** Descripción en TopBar/PageHeader para el módulo */
  headerDescription: string
}

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  accounting:  { id: "accounting",  label: "Contabilidad",  icon: Home,          iconName: "home",          primaryEntityLabel: 'accounting.account',                   permission: "accounting.view_dashboard_accounting",       defaultUrl: "/accounting/ledger?view=list", headerTitle: "Contabilidad", headerDescription: "Gestión centralizada del plan de cuentas, asientos, periodos y cumplimiento tributario." },
  sales:       { id: "sales",       label: "Ventas",        icon: Home,          iconName: "home",           primaryEntityLabel: 'sales.saleorder',                      permission: "sales.view_dashboard_sales",                defaultUrl: "/sales/dtes?view=card", headerTitle: "Ventas", headerDescription: "Gestión integral de pedidos, terminales, cobranza y puntos de venta." },
  contacts:    { id: "contacts",    label: "Contactos",     icon: Home,          iconName: "home",          primaryEntityLabel: 'contacts.contact',                     permission: null,                                         defaultUrl: "/contacts?view=list", headerTitle: "Contactos", headerDescription: "Gestión de clientes, proveedores y contactos comerciales." },
  inventory:   { id: "inventory",   label: "Inventario",    icon: Package,        iconName: "package",        primaryEntityLabel: 'inventory.product',                    permission: "inventory.view_dashboard_inventory",        defaultUrl: "/inventory/products?view=card", headerTitle: "Inventario", headerDescription: "Gestión centralizada de productos, existencias, almacenes y configuración." },
  production:  { id: "production",  label: "Producción",    icon: Home,          iconName: "home",           primaryEntityLabel: 'production.workorder',                  permission: "production.view_dashboard_production",       defaultUrl: "/production/orders?view=list", headerTitle: "Producción", headerDescription: "Gestión de órdenes de producción, listas de materiales y control de fabricación." },
  treasury:    { id: "treasury",    label: "Tesorería",     icon: Wallet,        iconName: "wallet",        primaryEntityLabel: null,                                   permission: "treasury.view_dashboard_treasury",          defaultUrl: "/treasury/operaciones/movements?view=card", headerTitle: "Tesorería", headerDescription: "Gestión centralizada de cuentas, movimientos y conciliación bancaria." },
  purchasing:  { id: "purchasing",  label: "Compras",       icon: Home,          iconName: "home",           primaryEntityLabel: 'purchasing.purchaseorder',             permission: "purchasing.view_dashboard_purchasing",      defaultUrl: "/purchasing/dtes?view=card", headerTitle: "Compras", headerDescription: "Gestión integral de órdenes de compra, notas y configuración." },
  finances:    { id: "finances",    label: "Finanzas",      icon: Home,          iconName: "home",           primaryEntityLabel: 'finance.bankjournal',                  permission: "finances.view_dashboard_finances",          defaultUrl: "/finances/statements/bs", headerTitle: "Finanzas", headerDescription: "Análisis financiero, presupuestos y estados de resultados." },
  hr:          { id: "hr",          label: "RRHH",          icon: Home,          iconName: "home",           primaryEntityLabel: 'hr.employee',                          permission: "hr.view_dashboard_hr",                     defaultUrl: "/hr/employees?view=list", headerTitle: "Recursos Humanos", headerDescription: "Gestión centralizada de personal, inasistencias, anticipos y liquidaciones." },
} as const

export const MODULE_ORDER = ["accounting", "sales", "contacts", "inventory", "production", "treasury", "purchasing", "finances", "hr"] as const

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

/** Obtiene config para Header del módulo (moduleName, moduleHref, headerTitle, headerDescription) */
export function getModuleHeaderConfig(id: string) {
  const mod = MODULE_REGISTRY[id]
  if (!mod) return null
  return {
    moduleName: mod.label,
    moduleHref: mod.defaultUrl,
    headerTitle: mod.headerTitle,
    headerDescription: mod.headerDescription,
    iconName: mod.iconName,
  }
}