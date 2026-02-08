import { Home, Calculator, Users, ShoppingCart, FileText, Package, Printer, Banknote, ShoppingBag, Calendar, PieChart, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
} from "@/components/ui/sidebar"


// Menu items grouped by category
const categoryItems: Record<string, any> = {
    "dashboard": [], // No sub-items for dashboard
    "accounting": [
        { title: "Plan de Cuentas", url: "/accounting/accounts" },
        { title: "Asientos Contables", url: "/accounting/entries" },
        { title: "Documentos Emitidos", url: "/billing/sales" },
        { title: "Documentos Recibidos", url: "/billing/purchases" },
    ],
    "contacts": [], // Simple list
    "sales": [
        { title: "Notas de Venta", url: "/sales/orders" },
        { title: "POS", url: "/sales/pos" },
        { title: "Terminales", url: "/sales/terminals" },
    ],

    "inventory": [
        { title: "Productos", url: "/inventory/products" },
        { title: "Stock", url: "/inventory/stock" },
        { title: "Suscripciones", url: "/subscriptions" },
        { title: "Unidades de Medida", url: "/inventory/uoms" },
        { title: "Atributos", url: "/inventory/attributes" },
    ],
    "production": [
        { title: "Ordenes de Trabajo", url: "/production/orders" },
        { title: "Materiales (BOM)", url: "/production/boms" },
    ],
    "treasury": [
        { title: "Cuentas de Tesorería", url: "/treasury/accounts" },

        { title: "Movimientos de Tesorería", url: "/treasury/movements" },
        { title: "Diferencias POS", url: "/treasury/differences" },
        { title: "Conciliación Bancaria", url: "/treasury/reconciliation" },
        { title: "Facturación Tarjetas", url: "/treasury/card-billing" },
    ],
    "purchasing": [
        { title: "Ordenes de Compra", url: "/purchasing/orders" },
    ],
    "finances": [
        { title: "Estados Financieros", url: "/finances/statements" },
        { title: "Análisis", url: "/finances/analysis" },
        { title: "Presupuestos", url: "/finances/budgets" },
    ],
}

const titles: Record<string, string> = {
    "dashboard": "Inicio",
    "accounting": "Contabilidad",
    "contacts": "Contactos",
    "sales": "Ventas",

    "inventory": "Inventario",
    "production": "Producción",
    "treasury": "Tesorería",
    "purchasing": "Compras",
    "finances": "Finanzas",
}

interface AppSidebarProps {
    activeCategory: string | null
    isVisible?: boolean
    onMouseEnter?: () => void
    onMouseLeave?: () => void
}

export function AppSidebar({ activeCategory, isVisible, onMouseEnter, onMouseLeave }: AppSidebarProps) {
    if (!activeCategory || activeCategory === "dashboard") return null

    const items = categoryItems[activeCategory] || []
    const title = titles[activeCategory] || ""

    if (items.length === 0) return null

    return (
        <aside
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={cn(
                "w-64 bg-sidebar border-r border-sidebar-border h-screen absolute top-0 left-[70px] flex flex-col pt-8 transition-all duration-300 ease-in-out z-40 shadow-2xl overflow-hidden",
                isVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
            )}
        >
            <div className="px-6 mb-8">
                <h2 className="text-xl font-bold text-sidebar-foreground tracking-tight">{title}</h2>
                <div className="h-0.5 w-6 bg-primary rounded-full mt-2" />
            </div>

            <nav className="flex-1 px-3 space-y-0.5">
                {items.map((item: any) => (
                    <Link
                        key={item.url}
                        href={item.url}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all group"
                    >
                        <div className="h-1 w-1 rounded-full bg-sidebar-foreground/20 group-hover:bg-primary group-hover:scale-150 transition-all" />
                        {item.title}
                    </Link>
                ))}
            </nav>
        </aside>
    )
}
