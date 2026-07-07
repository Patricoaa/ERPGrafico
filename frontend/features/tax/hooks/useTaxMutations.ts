import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/features/realtime'
import { taxApi } from '../api/taxApi'
import { TAX_KEYS } from './queryKeys'
import { showApiError } from '@/lib/errors'
import { invalidateCrossFeature } from '@/lib/invalidation'

export function useTaxCalculation() {
  const calcMutation = useMutation({
    mutationFn: (data: { year: number; month: number }) =>
      taxApi.calculateDeclaration(data),
    onError: (error: Error) => {
      showApiError(error, 'Error al calcular declaración')
    }
  })

  return { calculateTax: calcMutation.mutateAsync, isCalculatingTax: calcMutation.isPending }
}

export function useCreateDeclaration() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const createDeclarationMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      taxApi.createDeclaration(data),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [TAX_KEYS.declarations.all(), TAX_KEYS.periods.all()])
    }
  })

  return { createDeclaration: createDeclarationMutation.mutateAsync, isCreatingDeclaration: createDeclarationMutation.isPending }
}

export function useRegisterDeclaration() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const registerDeclarationMutation = useMutation({
    mutationFn: ({ id, data, idempotencyKey }: { id: number; data: { declaration_date: string }; idempotencyKey?: string }) =>
      taxApi.registerDeclaration(id, data, idempotencyKey),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [TAX_KEYS.declarations.all(), TAX_KEYS.periods.all()])
    }
  })

  return { registerDeclaration: registerDeclarationMutation.mutateAsync, isRegisteringDeclaration: registerDeclarationMutation.isPending }
}

export function useClosePeriod() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const closePeriodMutation = useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: number; idempotencyKey?: string }) =>
        taxApi.closePeriod(id, idempotencyKey),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [TAX_KEYS.periods.all()])
    }
  })

  return { closePeriod: closePeriodMutation.mutateAsync, isClosingPeriod: closePeriodMutation.isPending }
}

export function useReopenPeriod() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const reopenPeriodMutation = useMutation({
    mutationFn: (params: { id: number; reason?: string }) => taxApi.reopenPeriod(params),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [TAX_KEYS.periods.all()])
    }
  })

  return { reopenPeriod: reopenPeriodMutation.mutateAsync, isReopeningPeriod: reopenPeriodMutation.isPending }
}

export function useCreateTaxPayment() {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const createTaxPaymentMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      taxApi.createPayment(data),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [TAX_KEYS.periods.all(), TAX_KEYS.declarations.all()])
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al registrar pago')
    }
  })

  return { createTaxPayment: createTaxPaymentMutation.mutateAsync, isCreatingTaxPayment: createTaxPaymentMutation.isPending }
}

export function useCheckPeriodClosed() {
  const checkPeriodClosedMutation = useMutation({
    mutationFn: (date: string) => taxApi.checkPeriodClosed(date),
  })

  return { checkPeriodClosed: checkPeriodClosedMutation.mutateAsync, isCheckingPeriodClosed: checkPeriodClosedMutation.isPending }
}

export function useUploadF29Document(declarationId: number) {
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const uploadF29DocumentMutation = useMutation({
    mutationFn: (file: File) => taxApi.attachDeclarationDocument(declarationId, file),
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [TAX_KEYS.periods.all(), TAX_KEYS.declarations.all()])
    },
    onError: (error: Error) => {
      showApiError(error, 'Error al subir documento F29')
    },
  })

  return { uploadF29Document: uploadF29DocumentMutation.mutateAsync, isUploadingF29Document: uploadF29DocumentMutation.isPending }
}
