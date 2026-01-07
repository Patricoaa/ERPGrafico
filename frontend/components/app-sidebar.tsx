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

// Menu items.
const items = [
    {
        title: "Panel de Control",
        url: "/",
        icon: Home,
    },
    {
        title: "Contabilidad",
        url: "/accounting",
        icon: Calculator,
        items: [
            { title: "Plan de Cuentas", url: "/accounting/accounts" },
            { title: "Asientos Contables", url: "/accounting/entries" },
        ]
    },
    {
        title: "Contactos",
        url: "/contacts",
        icon: Users,
    },
    {
        title: "Ventas",
        url: "#",
        icon: ShoppingCart,
        items: [
            { title: "Notas de Venta", url: "/sales/orders" },
            { title: "POS", url: "/sales/pos" },
            { title: "Historial", url: "/sales/history" },
        ]
    },
    {
        title: "Facturación",
        url: "#",
        icon: FileText,
        items: [
            { title: "Documentos Emitidos", url: "/billing/sales" },
            { title: "Documentos Recibidos", url: "/billing/purchases" },
        ]
    },
    {
        title: "Inventario",
        url: "#",
        icon: Package,
        items: [
            { title: "Productos", url: "/inventory/products" },
            { title: "Stock", url: "/inventory/stock" },
            { title: "Reglas de Precio", url: "/inventory/pricing-rules" },
        ]
    },
    {
        title: "Producción",
        url: "/production",
        icon: Printer,
        items: [
            { title: "Ordenes de Trabajo", url: "/production/orders" },
            { title: "Materiales (BOM)", url: "/production/boms" },
        ]
    },
    {
        title: "Tesorería",
        url: "#",
        icon: Banknote,
        items: [
            { title: "Cajas y Bancos", url: "/treasury/accounts" },
            { title: "Ingresos y Egresos", url: "/treasury/payments" },
        ]
    },
    {
        title: "Compras",
        url: "#",
        icon: ShoppingBag,
        items: [
            { title: "Ordenes de Compra", url: "/purchasing/orders" },
        ]
    },
    {
        title: "Servicios",
        url: "#",
        icon: Calendar,
        items: [
            { title: "Contratos", url: "/services/contracts" },
            { title: "Obligaciones", url: "/services/obligations" },
        ]
    },
    {
        title: "Finanzas",
        url: "/finances",
        icon: FileText,
        items: [
            { title: "Estados Financieros", url: "/finances/statements" },
            { title: "Análisis", url: "/finances/analysis" },
            { title: "Presupuestos", url: "/finances/budgets" },
        ]
    },
    {
        title: "Configuración",
        url: "/settings",
        icon: Settings,
    },
]

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" className="border-r-0" variant="sidebar">
            <SidebarContent className="bg-sidebar text-sidebar-foreground">
                <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-foreground/70">ERPGrafico</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                        {item.items ? (
                                            <div className="flex items-center gap-2 w-full cursor-default">
                                                <item.icon className="h-4 w-4" />
                                                <span className="font-semibold">{item.title}</span>
                                            </div>
                                        ) : (
                                            <Link href={item.url}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.title}</span>
                                            </Link>
                                        )}
                                    </SidebarMenuButton>
                                    {item.items && (
                                        <SidebarMenuSub>
                                            {item.items.map((subItem) => (
                                                <SidebarMenuSubItem key={subItem.title}>
                                                    <SidebarMenuSubButton asChild>
                                                        <Link href={subItem.url}>
                                                            <span>{subItem.title}</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                        </SidebarMenuSub>
                                    )}
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}
