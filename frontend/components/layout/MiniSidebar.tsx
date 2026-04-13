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
    
    // New state for floating dock
    const [isOpen, setIsOpen] = useState(false)


    const handleCategoryClick = (id: string) => {
        onCategoryChange(id)
        setIsOpen(false) // Auto-close on selection
    }

    return (
        <>
            {/* 1. Logo Trigger Button - Fixed Top Left */}
            <div className="fixed top-4 left-4 z-[60]">
                <motion.div
                    initial={{ rotate: -10, scale: 0.9 }}
                    animate={{ rotate: isOpen ? 90 : 0, scale: 1 }}
                    whileHover={{ rotate: isOpen ? 0 : 90, scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-[0_8px_16px_rgba(var(--primary),0.3)] overflow-hidden border border-white/10">
                        {logo ? (
                            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            "ES"
                        )}
                    </div>
                </motion.div>
            </div>

            {/* 2. Backdrop Blur Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-colors duration-500"
                    />
                )}
            </AnimatePresence>

            {/* 3. Floating Dock - Animates Downwards */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="fixed top-20 left-4 w-[65px] flex flex-col items-center py-4 gap-4 bg-sidebar border border-sidebar-border/50 rounded-lg z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar"
                    >
                        <TooltipProvider delayDuration={0}>
                            {/* Main Navigation Items */}
                            <div className="flex flex-col gap-4">
                                {mainItems.map((item, index) => (
                                    <PermissionGuard permission={item.permission || undefined} key={item.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <motion.button
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.03 }}
                                                    whileHover={{ scale: 1.1, x: 2 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleCategoryClick(item.id)}
                                                    className={cn(
                                                        "p-3.5 rounded-xl transition-all duration-300 group relative flex items-center justify-center",
                                                        activeCategory === item.id
                                                            ? "bg-primary text-primary-foreground shadow-[0_10px_20px_rgba(var(--primary),0.3)]"
                                                            : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                                    )}
                                                >
                                                    <item.icon className={cn("h-5 w-5 transition-transform duration-300", activeCategory === item.id ? "scale-110" : "group-hover:scale-110")} />
                                                    
                                                    {activeCategory === item.id && (
                                                        <motion.span
                                                            layoutId="active-dot"
                                                            className="absolute -right-1 w-1 h-4 bg-primary rounded-full"
                                                        />
                                                    )}
                                                </motion.button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="font-bold uppercase tracking-widest text-[10px] bg-sidebar text-sidebar-foreground border-sidebar-border px-3 py-1.5 shadow-xl">
                                                {item.label}
                                            </TooltipContent>
                                        </Tooltip>
                                    </PermissionGuard>
                                ))}
                            </div>

                        </TooltipProvider>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    )
}
