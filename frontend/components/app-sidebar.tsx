import { Calendar, Home, Inbox, Search, Settings, Calculator, ShoppingCart, Package, Printer, Banknote, FileText, ShoppingBag, Users } from "lucide-react"
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
    ],
    "contacts": [], // Simple list
    "sales": [
        { title: "Notas de Venta", url: "/sales/orders" },
        { title: "POS", url: "/sales/pos" },
    ],
    "billing": [
        { title: "Documentos Emitidos", url: "/billing/sales" },
        { title: "Documentos Recibidos", url: "/billing/purchases" },
    ],
    "inventory": [
        { title: "Productos", url: "/inventory/products" },
        { title: "Stock", url: "/inventory/stock" },
        { title: "Unidades de Medida", url: "/inventory/uoms" },
    ],
    "production": [
        { title: "Ordenes de Trabajo", url: "/production/orders" },
        { title: "Materiales (BOM)", url: "/production/boms" },
    ],
    "treasury": [
        { title: "Cajas y Bancos", url: "/treasury/accounts" },
        { title: "Ingresos y Egresos", url: "/treasury/payments" },
    ],
    "purchasing": [
        { title: "Ordenes de Compra", url: "/purchasing/orders" },
    ],
    "services": [
        { title: "Contratos", url: "/services/contracts" },
        { title: "Obligaciones", url: "/services/obligations" },
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
    "billing": "Facturación",
    "inventory": "Inventario",
    "production": "Producción",
    "treasury": "Tesorería",
    "purchasing": "Compras",
    "services": "Servicios",
    "finances": "Finanzas",
}

interface AppSidebarProps {
    activeCategory: string | null
}

export function AppSidebar({ activeCategory }: AppSidebarProps) {
    if (!activeCategory || activeCategory === "dashboard") return null

    const items = categoryItems[activeCategory] || []
    const title = titles[activeCategory] || ""

    // If a category has no items but is not dashboard, it might just be a direct link
    // However, the user wants the second sidebar to show hierarchy.
    if (items.length === 0) return null

    return (
        <aside className="w-64 bg-sidebar/50 border-r border-sidebar-border h-screen sticky top-0 flex flex-col pt-8">
            <div className="px-6 mb-8">
                <h2 className="text-xl font-bold text-sidebar-foreground tracking-tight">{title}</h2>
                <div className="h-1 w-8 bg-primary rounded-full mt-2" />
            </div>

            <nav className="flex-1 px-3 space-y-1">
                {items.map((item: any) => (
                    <Link
                        key={item.url}
                        href={item.url}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all group"
                    >
                        <div className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/20 group-hover:bg-primary transition-colors" />
                        {item.title}
                    </Link>
                ))}
            </nav>

            <div className="p-6">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] uppercase font-bold text-primary/60 mb-1">Acceso Rápido</p>
                    <p className="text-xs text-sidebar-foreground/60 leading-relaxed">
                        Gestiona {title.toLowerCase()} de forma eficiente.
                    </p>
                </div>
            </div>
        </aside>
    )
}
