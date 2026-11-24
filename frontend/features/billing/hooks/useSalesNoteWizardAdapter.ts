"use client"

import { useCallback } from 'react'
import type { NoteWizardPayload, NoteWizardSourceDocument } from '@/features/notes'
import { billingApi } from '../api/billingApi'
import { buildSalesNoteFormData, parseSalesNoteSource } from '../utils/salesNoteAdapter'
import { useNoteCheckout } from './useNoteCheckout'

/**
 * Props de datos para `UnifiedNoteWizard` en modo ventas: carga la factura
 * origen y emite la NC/ND (invalida facturas vía `useNoteCheckout`).
 */
export function useSalesNoteWizardAdapter(invoiceId: number | null | undefined) {
    const { checkout } = useNoteCheckout()

    const fetchSource = useCallback(async (): Promise<NoteWizardSourceDocument> => {
        if (!invoiceId) throw new Error('No hay una factura origen válida para emitir la nota.')
        return parseSalesNoteSource(await billingApi.getInvoice(invoiceId))
    }, [invoiceId])

    const onSubmit = useCallback(async (payload: NoteWizardPayload): Promise<void> => {
        if (!invoiceId) throw new Error('No hay una factura origen válida para emitir la nota.')
        await checkout(buildSalesNoteFormData(invoiceId, payload))
    }, [invoiceId, checkout])

    return { fetchSource, onSubmit }
}
