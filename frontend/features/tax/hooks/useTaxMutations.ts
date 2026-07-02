import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/features/realtime'
import { taxApi } from '../api/taxApi'
import { TAX_KEYS } from './queryKeys'
import { showApiError } from '@/lib/errors'

export function useTaxCalculation() {
  return useMutation({
    mutationFn: (data: { year: number; month: number }) =>
      taxApi.calculateDeclaration(data),
    onError: (error: Error) => {
      showApiError(error, 'Error al calcular declaración')
    }
  })
}

export function useCreateDeclaration() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      taxApi.createDeclaration(data),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.declarations.all() })
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.periods.all() })
    }
  })
}

export function useRegisterDeclaration() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  return useMutation({
    mutationFn: ({ id, data, idempotencyKey }: { id: number; data: { declaration_date: string }; idempotencyKey?: string }) =>
      taxApi.registerDeclaration(id, data, idempotencyKey),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.declarations.all() })
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.periods.all() })
    }
  })
}

export function useClosePeriod() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  return useMutation({
    mutationFn: (id: number) => taxApi.closePeriod(id),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.periods.all() })
    }
  })
}

export function useReopenPeriod() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  return useMutation({
    mutationFn: (params: { id: number; reason?: string }) => taxApi.reopenPeriod(params),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.periods.all() })
    }
  })
}

export function useCreateTaxPayment() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      taxApi.createPayment(data),
    onSuccess: () => {
      markLocalMutation()
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.periods.all() })
      queryClient.invalidateQueries({ queryKey: TAX_KEYS.declarations.all() })
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al registrar pago')
    }
  })
}

export function useCheckPeriodClosed() {
  return useMutation({
    mutationFn: (date: string) => taxApi.checkPeriodClosed(date),
  })
}
