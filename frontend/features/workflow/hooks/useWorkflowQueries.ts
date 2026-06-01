import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { WorkflowRule, NotificationRule } from "@/types/entities"
import * as workflowApi from '../api/workflowApi'
import { WORKFLOW_KEYS } from './queryKeys'

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
            const res = await api.get<WorkflowRule[]>("/workflow/assignment-rules/")
            return res.data
        },
        staleTime: 10 * 60 * 1000, // 10 min — datos de configuración
    })
}

export function useNotificationRulesQuery() {
    return useQuery({
        queryKey: workflowKeys.notificationRules(),
        queryFn: async () => {
            const res = await api.get<NotificationRule[]>("/workflow/notification-rules/")
            return res.data
        },
        staleTime: 10 * 60 * 1000, // 10 min — datos de configuración
    })
}

export function useWorkflowRecurrentSettingsQuery() {
    return useQuery({
        queryKey: workflowKeys.recurrentSettings(),
        queryFn: async () => {
            const res = await api.get("/workflow/settings/current/")
            return res.data as WorkflowRecurrentSettings
        },
        staleTime: 10 * 60 * 1000, // 10 min — datos de configuración
    })
}

export function useTask(taskId: number | string) {
    return useQuery({
        queryKey: WORKFLOW_KEYS.taskDetail(taskId),
        queryFn: () => workflowApi.getTask(taskId),
        staleTime: 30 * 1000,
        enabled: !!taskId,
    })
}
