"use client"

import { useState, useEffect } from "react"
import { Bell, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, Notification } from "@/lib/workflow/api"
import { cn, formatPlainDate } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function NotificationBell() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [count, setCount] = useState(0)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(false)

    const fetchCount = async () => {
        try {
            const c = await getUnreadNotificationCount()
            setCount(c)
        } catch (e) {
            console.error("Error checking notifications", e)
        }
    }

    const fetchNotifications = async () => {
        setLoading(true)
        try {
            const res = await getNotifications()
            // Assume res is paginated (results) or list. 
            // Standard django rest viewset usually returns { count, results } or list if disabled pagination.
            // Let's safe check, assuming simple list or result. results is safer default for DRF.
            const list = Array.isArray(res) ? res : (res.results || [])
            setNotifications(list)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Initial check
        fetchCount()

        // Polling every 60s
        const interval = setInterval(fetchCount, 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (open) {
            fetchNotifications()
        }
    }, [open])

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead()
        setCount(0)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const handleItemClick = async (notif: Notification) => {
        if (!notif.read) {
            await markNotificationRead(notif.id)
            setCount(prev => Math.max(0, prev - 1))
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
        }
        setOpen(false)
        if (notif.link) {
            router.push(notif.link)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {count > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-background animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] md:w-[450px] p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm">Notificaciones</h4>
                    {count > 0 && (
                        <Button variant="ghost" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary" onClick={handleMarkAllRead}>
                            Marcar todo leído
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {loading ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">Cargando...</div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            Sin notificaciones
                        </div>
                    ) : (
                        <div className="grid gap-0">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={cn(
                                        "flex flex-col gap-1 p-4 border-b hover:bg-muted/50 transition-colors cursor-pointer",
                                        !notif.read && "bg-blue-50/50 dark:bg-blue-900/10"
                                    )}
                                    onClick={() => handleItemClick(notif)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className={cn("text-sm font-medium leading-none", !notif.read && "text-primary")}>
                                            {notif.title}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {formatPlainDate(notif.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                        {notif.message}
                                    </p>

                                    {notif.link && (
                                        <div className="mt-2 flex justify-end">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors">
                                                Ver producto <ArrowRight className="h-3 w-3" />
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t text-center">
                    <Link href="/tasks" className="text-xs text-muted-foreground hover:text-primary block w-full py-1">
                        Ver Bandeja Completa
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    )
}
