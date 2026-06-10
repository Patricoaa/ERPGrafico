import {
  Home, Calculator, Receipt, ShoppingCart, Users, Package,
  Printer, Banknote, ShoppingBag, PieChart, UserCog,
  type LucideIcon
} from "lucide-react"

export interface ModuleConfig {
  id: string
  label: string
  icon: LucideIcon
  iconName: string
  permission: string | null
  defaultUrl: string
}

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  dashboard:   { id: "dashboard",   label: "Inicio",        icon: Home,          iconName: "home",          permission: null,                                         defaultUrl: "/" },
  accounting:  { id: "accounting",  label: "Contabilidad",  icon: Calculator,     iconName: "calculator",     permission: "accounting.view_dashboard_accounting",       defaultUrl: "/accounting/ledger" },
  billing:     { id: "billing",     label: "Facturación",   icon: Receipt,        iconName: "receipt",        permission: "billing.view_dashboard_billing",             defaultUrl: "/billing/sales?view=card" },
  sales:       { id: "sales",       label: "Ventas",        icon: ShoppingCart,   iconName: "shopping-cart",   permission: "sales.view_dashboard_sales",                defaultUrl: "/sales/orders?tab=orders" },
  contacts:    { id: "contacts",    label: "Contactos",     icon: Users,          iconName: "users",          permission: null,                                         defaultUrl: "/contacts" },
  inventory:   { id: "inventory",   label: "Inventario",    icon: Package,        iconName: "package",        permission: "inventory.view_dashboard_inventory",        defaultUrl: "/inventory/products?tab=products" },
  production:  { id: "production",  label: "Producción",    icon: Printer,        iconName: "printer",        permission: "production.view_dashboard_production",       defaultUrl: "/production/orders" },
  treasury:    { id: "treasury",    label: "Tesorería",     icon: Banknote,       iconName: "banknote",       permission: "treasury.view_dashboard_treasury",          defaultUrl: "/treasury/operaciones?tab=movements" },
  purchasing:  { id: "purchasing",  label: "Compras",       icon: ShoppingBag,    iconName: "shopping-bag",    permission: "purchasing.view_dashboard_purchasing",      defaultUrl: "/purchasing/orders?tab=orders" },
  finances:    { id: "finances",    label: "Finanzas",      icon: PieChart,       iconName: "pie-chart",       permission: "finances.view_dashboard_finances",          defaultUrl: "/finances/statements?tab=bs" },
  hr:          { id: "hr",          label: "RRHH",          icon: UserCog,        iconName: "user-cog",        permission: "hr.view_dashboard_hr",                     defaultUrl: "/hr/employees" },
} as const

export function getModuleConfig(id: string): ModuleConfig | undefined {
  return MODULE_REGISTRY[id]
}

export function getModuleDefaultUrl(id: string): string {
  return MODULE_REGISTRY[id]?.defaultUrl ?? "/"
}

export function getModuleIconName(id: string): string | undefined {
  return MODULE_REGISTRY[id]?.iconName
}
