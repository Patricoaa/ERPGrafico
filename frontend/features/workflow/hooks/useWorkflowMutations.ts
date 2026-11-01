import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import * as workflowApi from '../api/workflowApi'
import { WORKFLOW_KEYS } from './queryKeys'
import { showApiError } from '@/lib/errors'
import { invalidateCrossFeature } from '@/lib/invalidation'

export function useCompleteTask() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const completeTaskMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => workflowApi.completeTask(id, notes),
    onSuccess: (result, variables) => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.taskDetail(variables.id), WORKFLOW_KEYS.tasks()])
      if (result.status === 'pending') {
        toast.info(`Aprobación registrada (${result.approvals_received}/${result.approvals_required}); falta otra persona del grupo.`)
      } else {
        toast.success('Aprobación completada')
      }
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al completar la tarea')
    }
  })

  return { completeTask: completeTaskMutation.mutateAsync, isCompletingTask: completeTaskMutation.isPending }
}

export function useRejectTask() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const rejectTaskMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => workflowApi.rejectTask(id, notes),
    onSuccess: (_, variables) => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.taskDetail(variables.id), WORKFLOW_KEYS.tasks()])
      toast.success('Aprobación rechazada')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al rechazar la aprobación')
    },
  })

  return { rejectTask: rejectTaskMutation.mutateAsync, isRejectingTask: rejectTaskMutation.isPending }
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => 
      workflowApi.updateTask(id, payload),
    onSuccess: (_, variables) => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.taskDetail(variables.id), WORKFLOW_KEYS.tasks()])
      toast.success('Tarea actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la tarea')
    }
  })

  return { updateTask: updateTaskMutation.mutateAsync, isUpdatingTask: updateTaskMutation.isPending }
}

export function useUpdateAssignmentRule() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const updateAssignmentRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: workflowApi.AssignmentRulePayload }) => 
      workflowApi.updateAssignmentRule(id, data),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.assignmentRules()])
      toast.success('Regla de asignación actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la regla de asignación')
    }
  })

  return { updateAssignmentRule: updateAssignmentRuleMutation.mutateAsync, isUpdatingAssignmentRule: updateAssignmentRuleMutation.isPending }
}

export function useCreateAssignmentRule() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const createAssignmentRuleMutation = useMutation({
    mutationFn: workflowApi.createAssignmentRule,
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.assignmentRules()])
      toast.success('Regla de asignación creada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al crear la regla de asignación')
    }
  })

  return { createAssignmentRule: createAssignmentRuleMutation.mutateAsync, isCreatingAssignmentRule: createAssignmentRuleMutation.isPending }
}

export function useUpdateNotificationRule() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const updateNotificationRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: workflowApi.NotificationRulePayload }) => 
      workflowApi.updateNotificationRule(id, data),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.notificationRules()])
      toast.success('Regla de notificación actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la regla de notificación')
    }
  })

  return { updateNotificationRule: updateNotificationRuleMutation.mutateAsync, isUpdatingNotificationRule: updateNotificationRuleMutation.isPending }
}

export function useCreateNotificationRule() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const createNotificationRuleMutation = useMutation({
    mutationFn: workflowApi.createNotificationRule,
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.notificationRules()])
      toast.success('Regla de notificación creada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al crear la regla de notificación')
    }
  })

  return { createNotificationRule: createNotificationRuleMutation.mutateAsync, isCreatingNotificationRule: createNotificationRuleMutation.isPending }
}

export function useUpdateWorkflowSettings() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const updateWorkflowSettingsMutation = useMutation({
    mutationFn: workflowApi.updateWorkflowSettings,
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [WORKFLOW_KEYS.workflowSettings()])
      toast.success('Configuración actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la configuración')
    }
  })

  return { updateWorkflowSettings: updateWorkflowSettingsMutation.mutateAsync, isUpdatingWorkflowSettings: updateWorkflowSettingsMutation.isPending }
}

export function useSaveApprovalPolicy() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()
  return useMutation({
    mutationFn: workflowApi.saveApprovalPolicy,
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: ["workflow-approval-policies"] })
      toast.success("Política de aprobación guardada")
    },
    onError: (error: Error) => {
      showApiError(error, "Error al guardar la política de aprobación")
    },
  })
}

export function useDeleteApprovalPolicy() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()
  return useMutation({
    mutationFn: workflowApi.deleteApprovalPolicy,
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: ["workflow-approval-policies"] })
      toast.success("Política eliminada")
    },
    onError: (error: Error) => {
      showApiError(error, "Error al eliminar la política")
    },
  })
}

export function useGetUnreadNotificationCount() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const getUnreadNotificationCountMutation = useMutation({
    mutationFn: workflowApi.getUnreadNotificationCount,
    onSuccess: (data) => {
      markLocalMutation()
      queryClient.setQueryData(WORKFLOW_KEYS.getUnreadNotificationCount(), data)
    }
  })

  return { getUnreadNotificationCount: getUnreadNotificationCountMutation.mutateAsync, isGettingUnreadNotificationCount: getUnreadNotificationCountMutation.isPending }
}