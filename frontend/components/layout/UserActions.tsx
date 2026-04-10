"use client"

import { User, Settings, LogOut, Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, Notification } from "@/lib/workflow/api"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function UserActions() {
    const router = useRouter()
    const { logout, user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [displayLimit] = useState(5)

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
            const interval = setInterval(fetchNotifications, 30000)
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
        <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={0}>
                {/* Notifications */}
                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="relative p-2.5 rounded-xl text-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all bg-sidebar/40 border border-white/5 shadow-sm"
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
                        <TooltipContent side="bottom" className="font-bold uppercase tracking-widest text-[10px] bg-sidebar text-sidebar-foreground border-sidebar-border">
                            Notificaciones
                        </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-[350px] border-sidebar-border shadow-2xl p-0 overflow-hidden" align="end" sideOffset={12}>
                        <div className="bg-muted/50 p-3 border-b border-border/50 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight text-foreground">Notificaciones</span>
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
                                    <DropdownMenuItem key={n.id} className="p-3 cursor-pointer" onClick={() => handleNotificationClick(n)}>
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
                                    <Button variant="ghost" className="p-0 rounded-xl h-10 w-10 overflow-hidden group bg-sidebar/40 border border-white/5 shadow-sm">
                                        <Avatar className="h-full w-full border border-primary/20 bg-muted/20">
                                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                                                {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </motion.div>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="font-bold text-[10px] uppercase bg-sidebar text-sidebar-foreground border-sidebar-border">
                            {user?.username || 'Usuario'}
                        </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-56 border-sidebar-border shadow-2xl" align="end" sideOffset={12}>
                        <DropdownMenuLabel className="font-normal py-3">
                            <div className="flex flex-col">
                                <p className="text-sm font-bold text-foreground">{user?.username || 'Usuario'}</p>
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
            </TooltipProvider>
        </div>
    )
}
