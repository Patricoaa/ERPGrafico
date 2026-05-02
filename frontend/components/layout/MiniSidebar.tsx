"use client"

import { Home, Calculator, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, Receipt, UserCog, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useState } from "react"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import { useBranding } from "@/contexts/BrandingProvider"
import { CropFrame } from "@/components/shared/CropFrame"

interface MiniSidebarProps {
    activeCategory: string | null
    onCategoryChange: (category: string) => void
}

const mainItems = [
    { id: "dashboard", icon: Home, label: "Inicio", permission: null },
    { id: "accounting", icon: Calculator, label: "Contabilidad", permission: "accounting.view_dashboard_accounting" },
    { id: "billing", icon: Receipt, label: "Facturación", permission: "billing.view_dashboard_billing" },
    { id: "sales", icon: ShoppingCart, label: "Ventas", permission: "sales.view_dashboard_sales" },
    { id: "contacts", icon: Users, label: "Contactos", permission: null },
    { id: "inventory", icon: Package, label: "Inventario", permission: "inventory.view_dashboard_inventory" },
    { id: "production", icon: Printer, label: "Producción", permission: "production.view_dashboard_production" },
    { id: "treasury", icon: Banknote, label: "Tesorería", permission: "treasury.view_dashboard_treasury" },
    { id: "purchasing", icon: ShoppingBag, label: "Compras", permission: "purchasing.view_dashboard_purchasing" },
    { id: "finances", icon: PieChart, label: "Finanzas", permission: "finances.view_dashboard_finances" },
    { id: "hr", icon: UserCog, label: "RRHH", permission: "hr.view_dashboard_hr" },
]

export function MiniSidebar({ activeCategory, onCategoryChange }: MiniSidebarProps) {
    const router = useRouter()
    const { logout, user } = useAuth()
    const { logo } = useBranding()

    const handleCategoryClick = (id: string) => {
        onCategoryChange(id)
    }

    const getInitials = () => {
        // Assume user might have a tenant/company name, fallback to "SD"
        const companyName = (user as any)?.tenant_name as string | undefined
            || (user as any)?.company_name as string | undefined;
        if (companyName) {
            return companyName.substring(0, 2).toUpperCase()
        }
        return "SD"
    }

    return (
        <aside className="fixed top-0 left-0 bottom-0 w-14 flex flex-col items-center py-4 gap-6 bg-sidebar border-r border-border/5 z-50">
            {/* 1. Logo */}
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-sm overflow-hidden shrink-0">
                {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                    getInitials()
                )}
            </div>

            {/* Separator */}
            <div className="w-8 h-px bg-border/20 shrink-0" />

            {/* 2. Navigation Rail */}
            <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto overflow-x-hidden scrollbar-hide">
                <TooltipProvider delayDuration={0}>
                    {mainItems.map((item, index) => (
                        <PermissionGuard permission={item.permission || undefined} key={item.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => handleCategoryClick(item.id)}
                                        className={cn(
                                            "relative h-10 w-10 flex items-center justify-center rounded-lg transition-all duration-200",
                                            activeCategory === item.id
                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                                : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {activeCategory === item.id && (
                                            <motion.div 
                                                layoutId="sidebar-active-indicator"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" 
                                            />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="font-bold uppercase tracking-widest text-[10px] bg-foreground text-background px-3 py-1.5 ml-2 shadow-xl">
                                    {item.label}
                                </TooltipContent>
                            </Tooltip>
                        </PermissionGuard>
                    ))}
                </TooltipProvider>
            </div>
        </aside>
    )
}
