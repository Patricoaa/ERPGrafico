"use client"

import { User, Settings, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import { EmptyState } from "@/components/shared"
import { useNotifications, type NotificationPayload } from "@/features/notifications/hooks/useNotifications"
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    type Notification,
} from "@/features/workflow"
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
import { Blobatar } from "@/components/ui/blobatar"
import { Button } from "@/components/ui/button"

const NOTIFICATIONS_SHOWN = 5

/**
 * Menú del avatar (pie del riel de módulos): perfil, notificaciones y sesión (ADR-0079).
 */
export function UserSidebarMenu() {
    const router = useRouter()
    const { logout, user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = useCallback(async () => {
        try {
            const [data, count] = await Promise.all([getNotifications(), getUnreadNotificationCount()])
            setNotifications(data)
            setUnreadCount(count)
        } catch (error) {
            console.error("Error fetching notifications in UserSidebarMenu:", error)
        }
    }, [])

    useNotifications((newNotification: NotificationPayload) => {
        setNotifications(prev => [newNotification as Notification, ...prev].slice(0, 20))
        setUnreadCount(prev => prev + 1)
    })

    useEffect(() => {
        if (!user) return
        let cancelled = false
        ;(async () => {
            await fetchNotifications()
        })()
        const interval = setInterval(() => {
            if (!cancelled) fetchNotifications()
        }, 120000)
        return () => { cancelled = true; clearInterval(interval) }
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

    const userLabel = user?.username || "Usuario"

    return (
        <TooltipProvider delayDuration={0}>
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label={unreadCount > 0 ? `${userLabel} — ${unreadCount} notificaciones sin leer` : userLabel}
                                className="relative h-8 w-8 rounded-full text-foreground/50 hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-95 border-0 bg-transparent shadow-none"
                            >
                                <Blobatar name={userLabel} className="h-full w-full rounded-full bg-transparent" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background" aria-hidden />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        {userLabel}{unreadCount > 0 && ` · ${unreadCount} sin leer`}
                    </TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="w-80 border-sidebar-border shadow-overlay p-0" align="end" side="right" sideOffset={12}>
                    <DropdownMenuLabel className="font-normal p-1.5">
                        <div className="flex items-center gap-2 rounded-lg bg-muted p-1.5">
                            <Blobatar name={userLabel} className="h-7 w-7 rounded-md" />
                            <div className="flex flex-col">
                                <p className="text-xs font-bold text-foreground leading-tight">
                                    {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || userLabel}
                                </p>
                                <p className="text-3xs uppercase text-muted-foreground leading-tight">{user?.groups?.[0] || 'Sin Rol'}</p>
                            </div>
                        </div>
                    </DropdownMenuLabel>

                    {/* Notificaciones */}
                    <div className="px-3 pt-2 pb-1 flex justify-between items-center">
                        <span className="text-xs font-semibold text-foreground">
                            Notificaciones{unreadCount > 0 && <span className="text-muted-foreground font-normal"> · {unreadCount} sin leer</span>}
                        </span>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-2xs font-medium" onClick={handleMarkAllRead}>
                                Leer todo
                            </Button>
                        )}
                    </div>
                    <div className="max-h-[260px] overflow-y-auto custom-scrollbar px-1">
                        {notifications.length === 0 ? (
                            <EmptyState context="generic" variant="compact" title="No hay notificaciones" />
                        ) : (
                            notifications.slice(0, NOTIFICATIONS_SHOWN).map((n) => (
                                <DropdownMenuItem key={n.id} className="p-2 cursor-pointer items-start gap-2" onClick={() => handleNotificationClick(n)}>
                                    <span className={n.read ? "mt-1.5 h-1.5 w-1.5 shrink-0" : "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"} aria-hidden />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="font-semibold text-xs">{n.title}</span>
                                        <p className="text-2xs text-muted-foreground line-clamp-2">{n.message}</p>
                                    </div>
                                </DropdownMenuItem>
                            ))
                        )}
                    </div>

                    <DropdownMenuSeparator />
                    <div className="p-1">
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
                        <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
                            <LogOut className="mr-3 h-4 w-4" />
                            <span className="text-xs font-medium">Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </TooltipProvider>
    )
}
