/**
 * Canonical types for the UnifiedNoteWizard.
 *
 * Both the sales flow (NoteCheckoutWizard) and the purchase flow
 * (PurchaseNoteModal) are mapped into these types before entering the wizard.
 * Each callsite is responsible for providing a `fetcher` and `onSubmit` that
 * translate between its domain types and these canonical ones.
 */

import type { PaymentData } from '@/features/treasury'

// ---------------------------------------------------------------------------
// Note type
// ---------------------------------------------------------------------------

export type NoteType = 'NOTA_CREDITO' | 'NOTA_DEBITO'

// ---------------------------------------------------------------------------
// Canonical line item
//
// Covers both:
//   - Sales: item selected from the original invoice (selectionMode = 'select')
//   - Purchase: line from a PO / purchase invoice (selectionMode = 'edit')
// ---------------------------------------------------------------------------

export interface NoteLineItem {
    /** Original line id from the source document (invoice line or PO line) */
    lineId: number | string

    /** Backend product id */
    productId: number | string

    productName: string
    productCode?: string
    uomName?: string

    /** Original quantity on the source document */
    originalQuantity: number

    /** Quantity included in this note (editable) */
    noteQuantity: number

    /** Unit price/cost included in this note (editable) */
    noteUnitPrice: number

    /** Tax amount per unit (used for totals in sales flow) */
    taxAmountPerUnit?: number

    // ---- Sales-only fields (logística / manufactura) ----
    productType?: string
    trackInventory?: boolean
    hasBom?: boolean
    requiresAdvancedManufacturing?: boolean
    mfgAutoFinalize?: boolean
    /** Derived: whether this line triggers a stock move */
    createsStockMove?: boolean

    /** Reason for the note (used in sales flow) */
    reason?: string

    /** Manufacturing configuration attached per-line (sales flow) */
    manufacturingData?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Wizard payload — what the wizard hands back to `onSubmit`
// ---------------------------------------------------------------------------

export interface NoteWizardPayload {
    noteType: NoteType

    /** Source document ids */
    sourceInvoiceId?: number
    sourceOrderId?: number

    /** Lines to include in the note */
    lines: NoteLineItem[]

    /** Computed totals (convenience for the API layer) */
    totalNet: number
    totalTax: number
    total: number

    /** DTE registration data */
    registration: {
        documentNumber: string
        documentDate: string   // ISO date string YYYY-MM-DD
        isPending: boolean
        attachment: File | null
    }

    /** Payment data (may be empty/pending) */
    payment: PaymentData

    /** Logistics data — only present for sales notes with stock moves */
    logistics?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Wizard configuration (controls which steps are shown)
// ---------------------------------------------------------------------------

export interface NoteWizardFeatures {
    /** Show the logistics step when items require stock moves (sales only) */
    logistics?: boolean

    /** Show the manufacturing details step (sales, NOTA_DEBITO + fab. products) */
    manufacturing?: boolean

    /** Show a read-only review step before payment (purchase flow) */
    reviewStep?: boolean
}

export type NoteWizardMode = 'sales' | 'purchase'

// ---------------------------------------------------------------------------
// Step identifiers (order-independent, used by the step sequencer)
// ---------------------------------------------------------------------------

export type NoteWizardStepId =
    | 'type-selector'   // optional: choose NOTA_CREDITO / NOTA_DEBITO
    | 'items'           // select / edit line items
    | 'manufacturing'   // optional: manufacturing details per item
    | 'logistics'       // optional: warehouse / logistics
    | 'registration'    // DTE folio + date + attachment
    | 'review'          // optional: read-only review before payment
    | 'payment'         // payment method

// ---------------------------------------------------------------------------
// Context data loaded at wizard init (provided by the caller's fetcher)
// ---------------------------------------------------------------------------

export interface NoteWizardSourceDocument {
    /** Display label, e.g. "FACTURA ELECTRONICA 45223" */
    label: string

    /** Whether the original document is tax-exempt */
    isExempt: boolean

    /** Supplier or customer name */
    counterpartyName?: string

    /** Contact id for folio duplicate validation (purchase flow) */
    contactId?: number

    /** Warehouse name for display in sidebar (purchase flow) */
    warehouseName?: string

    /** Total of the original document (used to pre-fill payment amount) */
    originalTotal: number

    /** Lines from the source document (normalised) */
    lines: NoteLineItem[]
}
