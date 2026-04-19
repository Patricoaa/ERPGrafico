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
    
    // New state for floating dock
    const [isOpen, setIsOpen] = useState(false)


    const handleCategoryClick = (id: string) => {
        onCategoryChange(id)
        setIsOpen(false) // Auto-close on selection
    }

    const getInitials = () => {
        // Assume user might have a tenant/company name, fallback to "SD"
        const companyName = (user as Record<string, unknown>)?.tenant_name as string | undefined
            || (user as Record<string, unknown>)?.company_name as string | undefined;
        if (companyName) {
            return companyName.substring(0, 2).toUpperCase()
        }
        return "SD"
    }

    return (
        <>
            {/* 1. Logo Trigger Button - Fixed Top Left, aligned to 64px topbar */}
            <div className="fixed top-[8px] left-4 z-[60]">
                <motion.div
                    initial={{ rotate: -10, scale: 0.9 }}
                    animate={{ rotate: isOpen ? 90 : 0, scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    className="cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="w-12 h-12 rounded-none bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-none overflow-hidden transition-colors hover:bg-primary/90">
                        {logo ? (
                            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            getInitials()
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
                        className="fixed top-20 left-4 w-12 flex flex-col items-center py-4 gap-4 bg-sidebar border border-sidebar-border/50 rounded-none z-50 shadow-2xl max-h-[calc(100vh-100px)] overflow-y-auto overflow-x-hidden scrollbar-hide"
                    >
                        <TooltipProvider delayDuration={0}>
                            {/* Main Navigation Items */}
                            <div className="flex flex-col gap-4">
                                {mainItems.map((item, index) => (
                                    <PermissionGuard permission={item.permission || undefined} key={item.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <CropFrame variant="compact">
                                                    <motion.button
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.03 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleCategoryClick(item.id)}
                                                        className={cn(
                                                            "h-8 w-8 relative flex items-center justify-center rounded-none transition-colors",
                                                            activeCategory === item.id
                                                                ? "bg-primary text-primary-foreground"
                                                                : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                                        )}
                                                    >
                                                        <item.icon className="h-5 w-5" />
                                                    </motion.button>
                                                </CropFrame>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="font-bold uppercase tracking-widest text-[10px] bg-sidebar text-sidebar-foreground border-sidebar-border px-3 py-1.5 shadow-md">
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
