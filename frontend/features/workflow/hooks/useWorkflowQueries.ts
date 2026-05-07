import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { WorkflowRule, NotificationRule } from "@/types/entities"

export interface WorkflowRecurrentSettings {
    f29_creation_day?: number
    f29_payment_day?: number
    period_close_day?: number
    low_margin_threshold_percent?: number
    [key: string]: number | undefined
}

export const workflowKeys = {
    rules: () => ["workflow-rules"] as const,
    notificationRules: () => ["workflow-notification-rules"] as const,
    recurrentSettings: () => ["workflow-recurrent-settings"] as const,
}

export function useWorkflowRulesQuery() {
    return useQuery({
        queryKey: workflowKeys.rules(),
        queryFn: async () => {
            const res = await api.get("/workflow/assignment-rules/")
            return (res.data.results ?? res.data) as WorkflowRule[]
        },
    })
}

export function useNotificationRulesQuery() {
    return useQuery({
        queryKey: workflowKeys.notificationRules(),
        queryFn: async () => {
            const res = await api.get("/workflow/notification-rules/")
            return (res.data.results ?? res.data) as NotificationRule[]
        },
    })
}

export function useWorkflowRecurrentSettingsQuery() {
    return useQuery({
        queryKey: workflowKeys.recurrentSettings(),
        queryFn: async () => {
            const res = await api.get("/workflow/settings/current/")
            return res.data as WorkflowRecurrentSettings
        },
    })
}
