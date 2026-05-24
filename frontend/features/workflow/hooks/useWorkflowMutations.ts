import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { markLocalMutation } from '@/lib/markLocalMutation'
import * as workflowApi from '../api/workflowApi'
import type { Task } from '@/types/entities'
import { WORKFLOW_KEYS } from './queryKeys'
import { showApiError } from '@/lib/api-error'

export function useCompleteTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: workflowApi.completeTask,
    onSuccess: (_, variables) => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.taskDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.tasks() })
      toast.success('Tarea completada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al completar la tarea')
    }
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => 
      workflowApi.updateTask(id, payload),
    onSuccess: (_, variables) => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.taskDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.tasks() })
      toast.success('Tarea actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la tarea')
    }
  })
}

export function useUpdateAssignmentRule() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: workflowApi.AssignmentRulePayload }) => 
      workflowApi.updateAssignmentRule(id, data),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.assignmentRules() })
      toast.success('Regla de asignación actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la regla de asignación')
    }
  })
}

export function useCreateAssignmentRule() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: workflowApi.createAssignmentRule,
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.assignmentRules() })
      toast.success('Regla de asignación creada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al crear la regla de asignación')
    }
  })
}

export function useUpdateNotificationRule() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: workflowApi.NotificationRulePayload }) => 
      workflowApi.updateNotificationRule(id, data),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.notificationRules() })
      toast.success('Regla de notificación actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la regla de notificación')
    }
  })
}

export function useCreateNotificationRule() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: workflowApi.createNotificationRule,
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.notificationRules() })
      toast.success('Regla de notificación creada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al crear la regla de notificación')
    }
  })
}

export function useUpdateWorkflowSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: workflowApi.updateWorkflowSettings,
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEYS.workflowSettings() })
      toast.success('Configuración actualizada exitosamente')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al actualizar la configuración')
    }
  })
}

export function useGetUnreadNotificationCount() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: workflowApi.getUnreadNotificationCount,
    onSuccess: (data) => {
      queryClient.setQueryData(WORKFLOW_KEYS.getUnreadNotificationCount(), data)
    }
  })
}