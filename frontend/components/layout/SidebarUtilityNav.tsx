"use client"

import { Inbox, Search } from "lucide-react"
import { UniversalSearch } from '@/components/shared'
import { useAuth } from "@/contexts/AuthContext"
import { useState, useEffect, useCallback } from "react"
import { useNotifications, type NotificationPayload } from "@/features/notifications/hooks/useNotifications"
import { getTasks } from '@/features/workflow'
import { SidebarNavItem } from "./SidebarNavItem"

interface SidebarUtilityNavProps {
    isInboxOpen?: boolean
    onInboxToggle?: () => void
}

/**
 * Accesos globales al tope del panel de módulo (patrón ERPNext v16, ADR-0079):
 * Buscar (Ctrl+K) y Bandeja de tareas. Las notificaciones viven en el menú del avatar.
 */
export function SidebarUtilityNav({ isInboxOpen, onInboxToggle }: SidebarUtilityNavProps) {
    const { user } = useAuth()
    const [pendingTasksCount, setPendingTasksCount] = useState(0)

    const fetchPendingTasks = useCallback(async () => {
        try {
            const [approvals, tasks] = await Promise.all([
                getTasks({ category: 'APPROVAL', status: 'PENDING' }),
                getTasks({ category: 'TASK', status: 'PENDING' })
            ])
            setPendingTasksCount(approvals.length + tasks.length)
        } catch (error) {
            console.error("Error fetching pending tasks in SidebarUtilityNav:", error)
        }
    }, [])

    useNotifications((notification: NotificationPayload) => {
        if (notification.notification_type?.startsWith('TASK')) {
            fetchPendingTasks()
        }
    })

    useEffect(() => {
        if (!user) return
        let cancelled = false
        ;(async () => {
            await fetchPendingTasks()
        })()
        const interval = setInterval(() => {
            if (!cancelled) fetchPendingTasks()
        }, 120000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [user, fetchPendingTasks])

    return (
        <div className="flex flex-col gap-px">
            <UniversalSearch
                renderTrigger={(open) => (
                    <SidebarNavItem
                        label="Buscar"
                        icon={Search}
                        onClick={open}
                        aria-label="Búsqueda universal (Ctrl+K)"
                        trailing={<kbd className="text-3xs text-muted-foreground font-sans">Ctrl K</kbd>}
                    />
                )}
            />

            <SidebarNavItem
                label="Bandeja de entrada"
                icon={Inbox}
                isActive={isInboxOpen}
                onClick={onInboxToggle}
                trailing={pendingTasksCount > 0 && !isInboxOpen ? (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive px-1 text-4xs font-medium text-destructive-foreground">
                        {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
                    </span>
                ) : undefined}
            />
        </div>
    )
}
