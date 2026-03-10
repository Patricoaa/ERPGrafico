"use client"

import { Home, Calculator, Users, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, User, Settings, LogOut, FileText, Receipt, Bell, CheckCircle2 } from "lucide-react"
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
    const { logo } = useBranding()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [displayLimit, setDisplayLimit] = useState(5)

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

    return (
        <aside
            className="w-[65px] flex flex-col items-center py-4 gap-2 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.3)]"
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
                <div className="w-11 h-11 rounded-[14px] bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-[0_8px_16px_rgba(0,0,0,0.3)] overflow-hidden">
                    {logo ? (
                        <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        "ES"
                    )}
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

                {/* Notifications & User Menu at Bottom */}
                <div className="mt-auto pt-4 flex flex-col gap-4 border-t border-sidebar-border/20 items-center w-full">
                    {/* Notifications Dropdown */}
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="relative p-2.5 rounded-[12px] text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
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
                            <TooltipContent side="right" className="font-bold uppercase tracking-widest text-[10px] bg-sidebar text-sidebar-foreground border-sidebar-border px-3 py-1.5 shadow-xl">
                                Notificaciones
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent className="w-80 border-sidebar-border shadow-2xl p-0 overflow-hidden" align="end" side="right" sideOffset={10}>
                            <div className="bg-muted/50 p-3 border-b border-border/50 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm tracking-tight">Notificaciones</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{unreadCount} pendientes</span>
                                </div>
                                {unreadCount > 0 && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[10px] font-bold uppercase tracking-tighter hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAllRead();
                                        }}
                                    >
                                        Marcar todo como leído
                                    </Button>
                                )}
                            </div>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="p-8 flex flex-col items-center justify-center text-muted-foreground text-center">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                            <CheckCircle2 className="h-6 w-6 opacity-20" />
                                        </div>
                                        <p className="text-xs font-medium">No tienes notificaciones</p>
                                    </div>
                                ) : (
                                    <>
                                        {notifications.slice(0, displayLimit).map((notification) => (
                                            <DropdownMenuItem 
                                                key={notification.id} 
                                                className={cn(
                                                    "p-3.5 cursor-pointer border-b border-border/5 last:border-0 hover:bg-muted/50 flex flex-col items-start gap-1 transition-colors relative",
                                                    !notification.read && "bg-primary/5 hover:bg-primary/10"
                                                )}
                                                onClick={() => handleNotificationClick(notification)}
                                            >
                                                {!notification.read && (
                                                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                                                )}
                                                <div className="flex items-start gap-3 w-full">
                                                    <div className={cn(
                                                        "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                                        notification.type === 'SUCCESS' ? "bg-emerald-500/10 text-emerald-600" :
                                                        notification.type === 'ERROR' ? "bg-rose-500/10 text-rose-600" :
                                                        notification.type === 'WARNING' ? "bg-amber-500/10 text-amber-600" :
                                                        "bg-primary/10 text-primary"
                                                    )}>
                                                        {notification.link?.includes('pos') ? (
                                                            <ShoppingCart className="h-4 w-4" />
                                                        ) : notification.link?.includes('purchasing') ? (
                                                            <Package className="h-4 w-4" />
                                                        ) : (
                                                            <Bell className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className={cn("text-xs truncate", !notification.read ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                                                            {notification.title}
                                                        </span>
                                                        <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed mt-0.5">
                                                            {notification.message}
                                                        </p>
                                                        <span className="text-[9px] text-muted-foreground/50 mt-1.5 font-medium flex items-center gap-1">
                                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                        {notifications.length > displayLimit && (
                                            <div className="p-2 border-t border-border/5 bg-muted/20">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="w-full h-8 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDisplayLimit(prev => prev + 5);
                                                    }}
                                                >
                                                    Mostrar {Math.min(5, notifications.length - displayLimit)} más...
                                                </Button>
                                            </div>
                                        )}
                                    </>
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
