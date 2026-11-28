"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications, type NotificationPayload } from "@/features/notifications"
import { getTasks } from "../api/workflowApi"

/** Aprobaciones + tareas pendientes del usuario, para la insignia de la Bandeja (polling 120 s + push de tareas). */
export function usePendingTasksCount(): number {
    const { user } = useAuth()
    const [count, setCount] = useState(0)

    const fetchPendingTasks = useCallback(async () => {
        try {
            const [approvals, tasks] = await Promise.all([
                getTasks({ category: "APPROVAL", status: "PENDING" }),
                getTasks({ category: "TASK", status: "PENDING" }),
            ])
            setCount(approvals.length + tasks.length)
        } catch (error) {
            console.error("Error fetching pending tasks:", error)
        }
    }, [])

    useNotifications((notification: NotificationPayload) => {
        if (notification.notification_type?.startsWith("TASK")) {
            void fetchPendingTasks()
        }
    })

    useEffect(() => {
        if (!user) return
        ;(async () => {
            await fetchPendingTasks()
        })()
        const interval = setInterval(() => { void fetchPendingTasks() }, 120000)
        return () => clearInterval(interval)
    }, [user, fetchPendingTasks])

    return count
}
