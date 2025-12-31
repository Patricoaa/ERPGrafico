import { Calendar, Home, Inbox, Search, Settings, Calculator, ShoppingCart, Package, Printer, Banknote, FileText, ShoppingBag } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

// Menu items.
const items = [
    {
        title: "Dashboard",
        url: "/",
        icon: Home,
    },
    {
        title: "Contabilidad",
        url: "/accounting",
        icon: Calculator,
        items: [
            { title: "Plan de Cuentas", url: "/accounting/accounts" },
            { title: "Libro Diario", url: "/accounting/entries" },
        ]
    },
    {
        title: "Ventas",
        url: "/sales",
        icon: ShoppingCart,
        items: [
            { title: "POS", url: "/sales/pos" },
            { title: "Clientes", url: "/sales/customers" },
        ]
    },
    {
        title: "Inventario",
        url: "/inventory",
        icon: Package,
        items: [
            { title: "Productos", url: "/inventory/products" },
            { title: "Categorías", url: "/inventory/categories" },
            { title: "Almacenes", url: "/inventory/warehouses" },
        ]
    },
    {
        title: "Producción",
        url: "/production",
        icon: Printer,
    },
    {
        title: "Tesorería",
        url: "/treasury",
        icon: Banknote,
        items: [
            { title: "Cajas y Bancos", url: "/treasury/journals" },
        ]
    },
    {
        title: "Compras",
        url: "/purchasing",
        icon: ShoppingBag,
        items: [
            { title: "Proveedores", url: "/purchasing/suppliers" },
        ]
    },
    {
        title: "Reportes",
        url: "/reports",
        icon: FileText,
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
                                        <a href={item.url}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}
