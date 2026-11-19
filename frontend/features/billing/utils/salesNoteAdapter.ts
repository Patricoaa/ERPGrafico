/**
 * Adaptador factura de venta → wizard de notas (NC/ND).
 *
 * Único lugar que traduce el contrato REST de la factura origen al documento
 * canónico del wizard (`NoteWizardSourceDocument`) y el payload del wizard al
 * `FormData` de `noteWorkflowCheckout`. Parsea con Zod en el borde: sin casts.
 */

import * as z from 'zod'
import type { NoteWizardPayload, NoteWizardSourceDocument } from '@/features/notes'

const DEFAULT_TAX_RATE = 19

/** DRF puede serializar decimales como string. Normaliza a number | undefined. */
const numeric = z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v) => {
        if (v === null || v === undefined || v === '') return undefined
        const n = Number(v)
        return Number.isFinite(n) ? n : undefined
    })

const sourceLineSchema = z.object({
    id: z.number(),
    product: z.number(),
    product_name: z.string().nullish(),
    product_code: z.string().nullish(),
    product_type: z.string().nullish(),
    track_inventory: z.boolean().nullish(),
    has_bom: z.boolean().nullish(),
    requires_advanced_manufacturing: z.boolean().nullish(),
    mfg_auto_finalize: z.boolean().nullish(),
    uom_name: z.string().nullish(),
    quantity: numeric,
    quantity_delivered: numeric,
    unit_price: numeric,
    tax_rate: numeric,
})

const sourceInvoiceSchema = z.object({
    id: z.number(),
    number: z.string().nullish(),
    dte_type: z.string(),
    dte_type_display: z.string().nullish(),
    total: numeric,
    customer_tax_id: z.string().nullish(),
    tax_id: z.string().nullish(),
    lines: z.array(sourceLineSchema).default([]),
})

const EXEMPT_DTE_TYPES = new Set(['FACTURA_EXENTA', 'BOLETA_EXENTA'])

/** Parsea la factura origen (respuesta cruda de la API) al documento canónico del wizard. */
export function parseSalesNoteSource(raw: unknown): NoteWizardSourceDocument {
    const inv = sourceInvoiceSchema.parse(raw)

    const lines = inv.lines.map((l) => {
        const unitPrice = l.unit_price ?? 0
        const trackInventory = l.track_inventory ?? undefined
        return {
            lineId: l.id,
            productId: l.product,
            productName: l.product_name ?? '',
            productCode: l.product_code ?? undefined,
            productType: l.product_type ?? undefined,
            trackInventory,
            hasBom: l.has_bom ?? undefined,
            requiresAdvancedManufacturing: l.requires_advanced_manufacturing ?? undefined,
            mfgAutoFinalize: l.mfg_auto_finalize ?? undefined,
            createsStockMove: Boolean(trackInventory) && l.product_type !== 'MANUFACTURABLE',
            uomName: l.uom_name ?? undefined,
            originalQuantity: l.quantity_delivered || l.quantity || 0,
            noteQuantity: 0,
            noteUnitPrice: unitPrice,
            taxAmountPerUnit: unitPrice * ((l.tax_rate ?? DEFAULT_TAX_RATE) / 100),
            reason: '',
        }
    })

    return {
        label: `${inv.dte_type_display ?? inv.dte_type} ${inv.number ?? ''}`.trim(),
        isExempt: EXEMPT_DTE_TYPES.has(inv.dte_type),
        originalTotal: inv.total ?? 0,
        lines,
        counterpartyRut: inv.customer_tax_id || inv.tax_id || undefined,
        invoiceId: inv.id,
    }
}

/** Traduce el payload del wizard al multipart que espera `noteWorkflowCheckout`. */
export function buildSalesNoteFormData(invoiceId: number, payload: NoteWizardPayload): FormData {
    const formData = new FormData()
    formData.append('original_invoice_id', String(invoiceId))
    formData.append('note_type', payload.noteType)
    formData.append('selected_items', JSON.stringify(payload.lines.map((l) => ({
        line_id: l.lineId,
        product_id: l.productId,
        quantity: l.noteQuantity,
        unit_price: l.noteUnitPrice,
        tax_amount: l.taxAmountPerUnit ?? 0,
        reason: l.reason ?? '',
        manufacturing_data: l.manufacturingData ?? null,
    }))))
    if (payload.logistics) formData.append('logistics_data', JSON.stringify(payload.logistics))

    const reg = payload.registration
    formData.append('registration_data', JSON.stringify({
        document_number: reg.documentNumber,
        document_date: reg.documentDate,
        is_pending: reg.isPending,
        fiscal_match_id: reg.pickedFiscalMatchId ?? null,
    }))
    if (reg.attachment) formData.append('document_attachment', reg.attachment)
    if (reg.pickedFiscalMatchId) formData.append('fiscal_match_id', String(reg.pickedFiscalMatchId))
    if (payload.payment.method) formData.append('payment_data', JSON.stringify(payload.payment))
    return formData
}
