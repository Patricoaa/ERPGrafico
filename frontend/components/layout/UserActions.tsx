"use client"

import { User, Settings, LogOut, Bell, Store, Calculator, Inbox } from "lucide-react"
import { EmptyState, UniversalSearch } from '@/components/shared'
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useNotifications, type NotificationPayload } from "@/features/notifications/hooks/useNotifications"
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    type Notification,
    getTasks
} from '@/features/workflow/api/workflowApi'
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
import { cn } from "@/lib/utils"

// Lazy load cost calculator
const CostCalculatorDrawer = dynamic(
    () => import("@/components/tools/CostCalculatorDrawer").then(m => ({ default: m.CostCalculatorDrawer })),
    { ssr: false }
)

interface UserActionsProps {
    isInboxOpen?: boolean
    onInboxToggle?: () => void
}

export function UserActions({ isInboxOpen, onInboxToggle }: UserActionsProps) {
    const router = useRouter()
    const { logout, user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [pendingTasksCount, setPendingTasksCount] = useState(0)
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
    const [displayLimit] = useState(5)

    const fetchData = useCallback(async () => {
        try {
            const [data, count, approvalsRes, tasksRes] = await Promise.all([
                getNotifications(),
                getUnreadNotificationCount(),
                getTasks({ category: 'APPROVAL', status: 'PENDING' }),
                getTasks({ category: 'TASK', status: 'PENDING' })
            ])

            setNotifications(data.results || data)
            setUnreadCount(count)

            const approvals = Array.isArray(approvalsRes) ? approvalsRes : (approvalsRes.results || [])
            const tasks = Array.isArray(tasksRes) ? tasksRes : (tasksRes.results || [])
            setPendingTasksCount(approvals.length + tasks.length)
        } catch (error) {
            console.error("Error fetching data in UserActions:", error)
        }
    }, [])

    useNotifications((newNotification: NotificationPayload) => {
        setNotifications(prev => [newNotification as any, ...prev].slice(0, 20))
        setUnreadCount(prev => prev + 1)

        // If it's a task related notification, we might want to refresh tasks too
        if (newNotification.notification_type?.startsWith('TASK')) {
            fetchData()
        }
    })

    useEffect(() => {
        if (!user) return
        let cancelled = false
        ;(async () => {
            await fetchData()
        })()
        const interval = setInterval(() => {
            if (!cancelled) fetchData()
        }, 120000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [user])

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
                {/* Universal Search */}
                <UniversalSearch />

                {/* POS Action */}
                <PermissionGuard permission="sales.view_dashboard_sales">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href="/pos"
                                target="_blank"
                                className="h-10 w-10 flex items-center justify-center rounded-md text-foreground/50 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                            >
                                <Store className="h-5 w-5" />
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Punto de Venta (POS)
                        </TooltipContent>
                    </Tooltip>
                </PermissionGuard>

                {/* Calculator Action */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setIsCalculatorOpen(true)}
                            className={cn(
                                "h-10 w-10 flex items-center justify-center rounded-md transition-all duration-200 active:scale-95",
                                isCalculatorOpen
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground/50 hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Calculator className="h-5 w-5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Calculadora de Costos
                    </TooltipContent>
                </Tooltip>

                {/* Inbox Action */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onInboxToggle}
                            className={cn(
                                "relative h-10 w-10 flex items-center justify-center rounded-md transition-all duration-200 active:scale-95",
                                isInboxOpen
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground/50 hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Inbox className="h-5 w-5" />
                            {pendingTasksCount > 0 && !isInboxOpen && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-black rounded-full px-1 shadow-card border-2 border-background">
                                    {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
                                </span>
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Bandeja de Entrada {pendingTasksCount > 0 && `(${pendingTasksCount})`}
                    </TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Notifications */}
                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="relative h-10 w-10 flex items-center justify-center rounded-md text-foreground/50 hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-95 bg-transparent border-none shadow-none"
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </span>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Notificaciones
                        </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-[350px] border-sidebar-border shadow-overlay p-0 overflow-hidden" align="end" sideOffset={12}>
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
                                <EmptyState context="generic" variant="compact" title="No hay notificaciones" />
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
                                <button
                                    className="relative h-10 w-10 flex items-center justify-center rounded-md text-foreground/50 hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-95 bg-transparent border border-border/60"
                                >
                                    <Avatar className="h-full w-full rounded-md bg-transparent">
                                        <AvatarFallback className="bg-transparent text-current font-heading font-black text-[10px] rounded-md">
                                            {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {user?.username || 'Usuario'}
                        </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-56 border-sidebar-border shadow-overlay" align="end" sideOffset={12}>
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
                            <span className="font-bold text-xs">Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TooltipProvider>

            <CostCalculatorDrawer open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
        </div>
    )
}
