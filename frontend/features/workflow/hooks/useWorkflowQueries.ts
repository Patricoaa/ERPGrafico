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
    const { data: rules, isLoading, isError } = useQuery({
        queryKey: workflowKeys.rules(),
        queryFn: async () => {
            const res = await api.get<{ results: WorkflowRule[] }>("/workflow/assignment-rules/")
            return res.data.results
        },
        staleTime: 10 * 60 * 1000,
    })
    return { rules: rules ?? [], isLoading, isError }
}

export function useNotificationRulesQuery() {
    const { data: notificationRules, isLoading, isError } = useQuery({
        queryKey: workflowKeys.notificationRules(),
        queryFn: async () => {
            const res = await api.get<{ results: NotificationRule[] }>("/workflow/notification-rules/")
            return res.data.results
        },
        staleTime: 10 * 60 * 1000,
    })
    return { notificationRules: notificationRules ?? [], isLoading, isError }
}

export function useWorkflowRecurrentSettingsQuery() {
    const { data: recurrentSettings, isLoading, isError } = useQuery({
        queryKey: workflowKeys.recurrentSettings(),
        queryFn: async () => {
            const res = await api.get("/workflow/settings/current/")
            return res.data as WorkflowRecurrentSettings
        },
        staleTime: 10 * 60 * 1000,
    })
    return { recurrentSettings: recurrentSettings ?? undefined, isLoading, isError }
}

export function useTask(taskId: number | string) {
    const { data: task, isLoading, isError } = useQuery({
        queryKey: WORKFLOW_KEYS.taskDetail(taskId),
        queryFn: () => workflowApi.getTask(taskId),
        staleTime: 30 * 1000,
        enabled: !!taskId,
    })
    return { task: task ?? null, isLoading, isError }
}
