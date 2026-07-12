import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { getTasks, type Task } from '../api/workflowApi'
import { WORKFLOW_KEYS } from './queryKeys'

interface TaskListResponse {
    results: Task[]
}

function normalizeTasks(data: Task[] | TaskListResponse | undefined): Task[] {
    if (!data) return []
    return Array.isArray(data) ? data : (data.results || [])
}

export function useTasks() {
    const queryClient = useQueryClient()

    const approvalsQuery = useQuery({
        queryKey: [...WORKFLOW_KEYS.tasks(), 'approvals'],
        queryFn: () => getTasks({ category: 'APPROVAL' }),
        refetchInterval: 30_000,
        staleTime: 15_000,
    })

    const operationalQuery = useQuery({
        queryKey: [...WORKFLOW_KEYS.tasks(), 'operational'],
        queryFn: () => getTasks({ category: 'TASK', status: 'PENDING' }),
        refetchInterval: 30_000,
        staleTime: 15_000,
    })

    const approvalTasks = normalizeTasks(approvalsQuery.data)
    const operationalTasks = normalizeTasks(operationalQuery.data)

    const lastApprovalsCount = useRef<number | null>(null)
    const lastTasksCount = useRef<number | null>(null)

    const currentPendingApprovals = approvalTasks.filter((t: Task) => t.status === 'PENDING').length
    const currentPendingTasks = operationalTasks.length

    useEffect(() => {
        if (approvalsQuery.isFetching && lastApprovalsCount.current !== null) {
            if (currentPendingApprovals > lastApprovalsCount.current) {
                toast.success("Nueva aprobación recibida", {
                    description: "Tienes una nueva solicitud pendiente de revisión.",
                    duration: 5000,
                })
            }
        }
        if (operationalQuery.isFetching && lastTasksCount.current !== null) {
            if (currentPendingTasks > lastTasksCount.current) {
                toast.info("Nueva tarea recibida", {
                    description: "Se ha asignado una nueva tarea operativa a tu bandeja.",
                    duration: 5000,
                })
            }
        }
        lastApprovalsCount.current = currentPendingApprovals
        lastTasksCount.current = currentPendingTasks
    }, [currentPendingApprovals, currentPendingTasks, approvalsQuery.isFetching, operationalQuery.isFetching])

    const refetch = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.tasks() })
    }, [queryClient])

    const isLoading = approvalsQuery.isLoading || operationalQuery.isLoading

    return {
        approvalTasks,
        operationalTasks,
        isLoading,
        refetch,
    }
}
