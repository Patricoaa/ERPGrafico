"use client"

import { useState, useCallback, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UseReopenConfirmOptions {
  periodType: 'contable' | 'tributario (F29)'
}

interface UseReopenConfirmReturn {
  confirmAndExecute: (id: number) => void
  dialog: ReactNode
}

export function useReopenConfirm(
  mutationFn: (params: { id: number; reason?: string }) => Promise<unknown>,
  options: UseReopenConfirmOptions,
): UseReopenConfirmReturn {
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const confirmAndExecute = useCallback((id: number) => {
    setPendingId(id)
    setReason('')
    setOpen(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (pendingId === null) return
    setIsSubmitting(true)
    try {
      await mutationFn({ id: pendingId, reason: reason || undefined })
    } finally {
      setIsSubmitting(false)
      setOpen(false)
      setPendingId(null)
    }
  }, [pendingId, reason, mutationFn])

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir período {options.periodType}</AlertDialogTitle>
          <AlertDialogDescription>
            Está a punto de reabrir un período cerrado. Esto permitirá modificar
            documentos en ese período.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-3">
          <Label htmlFor="reopen-reason">Motivo de la reapertura</Label>
          <Input
            id="reopen-reason"
            placeholder="Opcional: indique la razón..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingId(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Reabriendo...' : 'Confirmar reapertura'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirmAndExecute, dialog }
}
