"use client"

import { Home, Calculator, Users, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, User, Settings, LogOut, FileText, Receipt, Bell, CheckCircle2, ArrowRight, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, Notification } from "@/lib/workflow/api"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
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
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [displayLimit, setDisplayLimit] = useState(5)
    
    // New state for floating dock
    const [isOpen, setIsOpen] = useState(false)

    const fetchNotifications = useCallback(async () => {
        try {
            const [data, count] = await Promise.all([
                getNotifications(),
                getUnreadNotificationCount()
            ])
            setNotifications(data.results || data)
            setUnreadCount(count)
        } catch (error) {
            console.error("Error fetching notifications:", error)
        }
    }, [])

    useEffect(() => {
        if (user) {
            fetchNotifications()
            const interval = setInterval(fetchNotifications, 30000) // refresh every 30 seconds
            return () => clearInterval(interval)
        }
    }, [user, fetchNotifications])

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            try {
                await markNotificationRead(notification.id)
                setUnreadCount(prev => Math.max(0, prev - 1))
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
            } catch (error) {
                console.error("Error marking notification as read:", error)
            }
        }
        if (notification.link) {
            router.push(notification.link)
        }
    }

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead()
            setUnreadCount(0)
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            toast.success("Todas las notificaciones marcadas como leídas")
        } catch (error) {
            console.error("Error marking all as read:", error)
        }
    }

    const handleLogout = () => {
        logout()
    }

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
                        className="fixed top-20 left-4 w-[65px] flex flex-col items-center py-4 gap-4 bg-sidebar border border-sidebar-border/50 rounded-2xl z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar"
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

                            <div className="w-8 h-px bg-sidebar-border/20 my-2" />

                            {/* Notifications & User Menu */}
                            <div className="flex flex-col gap-4 items-center">
                                {/* Notifications */}
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="relative p-2.5 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
                                                >
                                                    <Bell className="h-5 w-5" />
                                                    {unreadCount > 0 && (
                                                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                                                        </span>
                                                    )}
                                                </motion.button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="font-bold uppercase tracking-widest text-[10px] bg-sidebar text-sidebar-foreground">
                                            Notificaciones
                                        </TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent className="w-[350px] border-sidebar-border shadow-2xl p-0 overflow-hidden" align="start" side="right" sideOffset={20}>
                                        <div className="bg-muted/50 p-3 border-b border-border/50 flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm tracking-tight">Notificaciones</span>
                                            </div>
                                            {unreadCount > 0 && (
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase" onClick={handleMarkAllRead}>
                                                    Leer Todo
                                                </Button>
                                            )}
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-muted-foreground text-xs">No hay notificaciones</div>
                                            ) : (
                                                notifications.slice(0, displayLimit).map((n) => (
                                                    <DropdownMenuItem key={n.id} className="p-3" onClick={() => handleNotificationClick(n)}>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold text-xs">{n.title}</span>
                                                            <p className="text-[10px] text-muted-foreground line-clamp-2">{n.message}</p>
                                                        </div>
                                                    </DropdownMenuItem>
                                                ))
                                            )}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* User Menu */}
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <motion.div whileHover={{ scale: 1.05 }} className="cursor-pointer">
                                                    <Button variant="ghost" className="p-0 rounded-xl h-11 w-11 overflow-hidden group">
                                                        <Avatar className="h-full w-full border border-primary/20 bg-muted/20">
                                                            <AvatarFallback className="bg-primary/5 text-primary font-black text-[10px]">
                                                                {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </Button>
                                                </motion.div>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="font-bold text-[10px] uppercase bg-sidebar text-sidebar-foreground">
                                            {user?.username || 'Usuario'}
                                        </TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent className="w-56 border-sidebar-border shadow-2xl" align="start" side="right" sideOffset={20}>
                                        <DropdownMenuLabel className="font-normal py-3">
                                            <div className="flex flex-col">
                                                <p className="text-sm font-bold">{user?.username || 'Usuario'}</p>
                                                <p className="text-[10px] uppercase text-muted-foreground">{user?.groups?.[0] || 'Sin Rol'}</p>
                                            </div>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                                            <User className="mr-3 h-4 w-4 text-primary" />
                                            <span className="text-xs">Perfil</span>
                                        </DropdownMenuItem>
                                        <PermissionGuard permission="core.change_companysettings">
                                            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                                                <Settings className="mr-3 h-4 w-4 text-primary" />
                                                <span className="text-xs">Configuración</span>
                                            </DropdownMenuItem>
                                        </PermissionGuard>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                                            <LogOut className="mr-3 h-4 w-4" />
                                            <span className="font-bold text-xs">Salir</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </TooltipProvider>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    )
}
