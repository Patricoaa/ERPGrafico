"use client"

import { Home, Calculator, Users, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, User, Settings, LogOut, FileText, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

import { motion, AnimatePresence } from "framer-motion"

interface MiniSidebarProps {
    activeCategory: string | null
    onCategoryChange: (category: string) => void
    onHoverCategory?: (category: string | null) => void
}

const mainItems = [
    { id: "dashboard", icon: Home, label: "Inicio", permission: null },
    { id: "accounting", icon: Calculator, label: "Contabilidad", permission: "accounting.view_dashboard_accounting" },
    { id: "billing", icon: Receipt, label: "Facturación", permission: "billing.view_dashboard_billing" },
    { id: "contacts", icon: Users, label: "Contactos", permission: "contacts.view_dashboard_contacts" },
    { id: "sales", icon: ShoppingCart, label: "Ventas", permission: "sales.view_dashboard_sales" },
    { id: "inventory", icon: Package, label: "Inventario", permission: "inventory.view_dashboard_inventory" },
    { id: "production", icon: Printer, label: "Producción", permission: "production.view_dashboard_production" },
    { id: "treasury", icon: Banknote, label: "Tesorería", permission: "treasury.view_dashboard_treasury" },
    { id: "purchasing", icon: ShoppingBag, label: "Compras", permission: "purchasing.view_dashboard_purchasing" },
    { id: "finances", icon: PieChart, label: "Finanzas", permission: "finances.view_dashboard_finances" },
]

export function MiniSidebar({ activeCategory, onCategoryChange, onHoverCategory }: MiniSidebarProps) {
    const router = useRouter()
    const { logout, user } = useAuth()

    const handleLogout = () => {
        logout()
    }

    return (
        <aside
            className="w-[75px] flex flex-col items-center py-8 gap-4 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.3)]"
            onMouseLeave={() => onHoverCategory?.(null)}
        >
            {/* Logo */}
            <motion.div
                initial={{ rotate: -10, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                whileHover={{ rotate: 90, scale: 1.1 }}
                className="mb-6 cursor-pointer"
                onClick={() => onCategoryChange("dashboard")}
            >
                <div className="w-11 h-11 rounded-[14px] bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-[0_8px_16px_rgba(var(--primary),0.3)]">
                    ES
                </div>
            </motion.div>

            {/* Main Navigation Items */}
            <TooltipProvider delayDuration={0}>
                <div className="flex-1 flex flex-col gap-4">
                    {mainItems.map((item, index) => (
                        <PermissionGuard permission={item.permission || undefined} key={item.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <motion.button
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                                        whileHover={{ scale: 1.1, x: 5 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => onCategoryChange(item.id)}
                                        onMouseEnter={() => onHoverCategory?.(item.id)}
                                        className={cn(
                                            "p-3.5 rounded-[12px] transition-all duration-300 group relative flex items-center justify-center",
                                            activeCategory === item.id
                                                ? "bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(var(--primary),0.25)]"
                                                : "text-sidebar-foreground/30 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 transition-transform duration-300", activeCategory === item.id ? "scale-110" : "group-hover:scale-110")} />

                                        {activeCategory === item.id && (
                                            <motion.span
                                                layoutId="active-indicator"
                                                className="absolute left-[-20px] top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full shadow-[4px_0_12px_rgba(var(--primary),0.5)]"
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

                {/* User Menu at Bottom */}
                <div className="mt-auto pt-6 border-t border-sidebar-border/20">
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <motion.div whileHover={{ scale: 1.05 }} className="cursor-pointer">
                                        <Button variant="ghost" className="p-0 rounded-[12px] h-11 w-11 overflow-hidden group">
                                            <Avatar className="h-full w-full border border-primary/20 bg-muted/20">
                                                <AvatarImage src="" alt="User" />
                                                <AvatarFallback className="bg-primary/5 text-primary font-black text-[10px] tracking-tighter">
                                                    {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Button>
                                    </motion.div>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-bold text-[10px] uppercase tracking-widest bg-sidebar text-sidebar-foreground border-sidebar-border">
                                {user?.username || 'Usuario'}
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent className="w-56 border-sidebar-border shadow-2xl" align="end" side="right">
                            <DropdownMenuLabel className="font-normal py-3">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-bold tracking-tight">{user?.username || 'Usuario'}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                                        {user?.groups?.[0] || 'Sin Rol'}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push("/profile")} className="py-2.5 cursor-pointer">
                                <User className="mr-3 h-4 w-4 text-primary" />
                                <span className="font-medium text-xs">Mi Perfil</span>
                            </DropdownMenuItem>
                            <PermissionGuard permission="core.change_companysettings">
                                <DropdownMenuItem onClick={() => router.push("/settings")} className="py-2.5 cursor-pointer">
                                    <Settings className="mr-3 h-4 w-4 text-primary" />
                                    <span className="font-medium text-xs">Configuración</span>
                                </DropdownMenuItem>
                            </PermissionGuard>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="py-2.5 text-destructive focus:text-destructive cursor-pointer">
                                <LogOut className="mr-3 h-4 w-4" />
                                <span className="font-bold text-xs">Cerrar Sesión</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </TooltipProvider>
        </aside>
    )
}
