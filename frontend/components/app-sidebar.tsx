"use client"

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
        { title: "Configuración Contable", url: "/settings/accounting" },
        { title: "Plan de Cuentas", url: "/accounting/accounts" },
        { title: "Asientos Contables", url: "/accounting/entries" },
        { title: "Periodos Contables", url: "/accounting/periods" },
    ],
    "billing": [
        { title: "Configuración Facturación", url: "/settings/billing" },
        { title: "Documentos Emitidos", url: "/billing/sales" },
        { title: "Documentos Recibidos", url: "/billing/purchases" },
        { title: "Declaraciones F29", url: "/tax/declarations" },
    ],
    "contacts": [], // Simple list
    "sales": [
        { title: "Configuración Ventas", url: "/settings/sales" },
        { title: "Notas de Venta", url: "/sales/orders" },
        { title: "POS", url: "/sales/pos" },
        { title: "Terminales", url: "/sales/terminals" },
    ],

    "inventory": [
        { title: "Configuración Inventario", url: "/settings/inventory" },
        { title: "Productos", url: "/inventory/products" },
        { title: "Stock", url: "/inventory/stock" },
        { title: "Suscripciones", url: "/subscriptions" },
        { title: "Unidades de Medida", url: "/inventory/uoms" },
        { title: "Atributos", url: "/inventory/attributes" },
    ],
    "production": [
        { title: "Configuración Producción", url: "/settings/production" },
        { title: "Ordenes de Trabajo", url: "/production/orders" },
        { title: "Materiales (BOM)", url: "/production/boms" },
    ],
    "treasury": [
        { title: "Configuración Tesorería", url: "/settings/treasury" },
        { title: "Cuentas de Tesorería", url: "/treasury/accounts" },
        { title: "Movimientos de Tesorería", url: "/treasury/movements" },
        { title: "Conciliación Bancaria", url: "/treasury/reconciliation" },
    ],
    "purchasing": [
        { title: "Configuración Compras", url: "/settings/purchasing" },
        { title: "Ordenes de Compra", url: "/purchasing/orders" },
    ],
    "finances": [
        { title: "Estados Financieros", url: "/finances/statements" },
        { title: "Análisis", url: "/finances/analysis" },
        { title: "Presupuestos", url: "/finances/budgets" },
    ],
    "hr": [
        { title: "Configuración RRHH", url: "/settings/hr" },
        { title: "Personal", url: "/hr/employees" },
        { title: "Liquidaciones", url: "/hr/payrolls" },
    ],
}

const titles: Record<string, string> = {
    "dashboard": "Inicio",
    "accounting": "Contabilidad",
    "billing": "Facturación",
    "contacts": "Contactos",
    "sales": "Ventas",

    "inventory": "Inventario",
    "production": "Producción",
    "treasury": "Tesorería",
    "purchasing": "Compras",
    "finances": "Finanzas",
    "hr": "Recursos Humanos",
}

interface AppSidebarProps {
    activeCategory: string | null
    isVisible?: boolean
    onMouseEnter?: () => void
    onMouseLeave?: () => void
}

import { motion, AnimatePresence } from "framer-motion"

export function AppSidebar({ activeCategory, isVisible, onMouseEnter, onMouseLeave }: AppSidebarProps) {
    const items = categoryItems[activeCategory || ""] || []
    const title = titles[activeCategory || ""] || ""

    return (
        <AnimatePresence>
            {isVisible && activeCategory && activeCategory !== "dashboard" && (
                <motion.aside
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    className={cn(
                        "w-72 bg-sidebar backdrop-blur-xl border-r border-sidebar-border h-screen absolute top-0 left-[65px] flex flex-col pt-12 z-40 shadow-[10px_0_50px_rgba(0,0,0,0.4)] overflow-hidden"
                    )}
                >
                    <div className="px-8 mb-10">
                        <motion.h2
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-2xl font-black text-sidebar-foreground tracking-[0.2em] uppercase font-heading"
                        >
                            {title}
                        </motion.h2>
                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.2 }}
                            className="h-1 w-8 bg-primary mt-3 origin-left"
                        />
                    </div>

                    <nav className="flex-1 px-4 space-y-1">
                        {items.map((item: any, idx: number) => (
                            <motion.div
                                key={item.url}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.15 + (idx * 0.03) }}
                            >
                                <Link
                                    href={item.url}
                                    className="flex items-center gap-4 px-5 py-3 rounded-[10px] text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/40 hover:bg-primary/10 hover:text-primary transition-all group font-mono"
                                >
                                    <div className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/10 group-hover:bg-primary group-hover:scale-150 transition-all duration-300" />
                                    {item.title}
                                </Link>
                            </motion.div>
                        ))}
                    </nav>

                    {/* Industrial Decoration at bottom */}
                    <div className="p-8 opacity-10 pointer-events-none">
                        <div className="text-[40px] font-black tracking-tighter leading-none select-none uppercase font-heading">
                            {title}
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}
