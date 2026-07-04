/**
 * useNoteWizardState
 *
 * Centralises all runtime state for the UnifiedNoteWizard.
 * Both the sales flow and the purchase flow share this hook — the
 * differences are driven by `mode` and `features`.
 *
 * The hook is intentionally side-effect-free with respect to APIs:
 * the caller supplies `fetchSource` and `onSubmit` so that each domain
 * keeps its own API dependency.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { PricingUtils } from '@/lib/pricing-utils'
import type {
    NoteLineItem,
    NoteType,
    NoteWizardFeatures,
    NoteWizardMode,
    NoteWizardPayload,
    NoteWizardSourceDocument,
    NoteWizardStepId,
} from '../types'
import type { PaymentData } from '@/features/treasury'

// ---------------------------------------------------------------------------
// Registration state (DTE step)
// ---------------------------------------------------------------------------

export interface RegistrationData {
    documentNumber: string
    documentDate: string   // YYYY-MM-DD
    isPending: boolean
    attachment: File | null
}

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface UseNoteWizardStateOptions {
    open: boolean
    mode: NoteWizardMode
    initialType: NoteType
    allowTypeChange: boolean
    features: Required<NoteWizardFeatures>
    serverDateString: string | null

    /**
     * Called once when `open` becomes true.
     * Should return the normalised source document or throw on error.
     */
    fetchSource: () => Promise<NoteWizardSourceDocument>
}

// ---------------------------------------------------------------------------
// Hook return value
// ---------------------------------------------------------------------------

export interface NoteWizardState {
    // ---- Source document ----
    sourceDocument: NoteWizardSourceDocument | null
    initializing: boolean

    // ---- Note type ----
    noteType: NoteType
    setNoteType: (t: NoteType) => void

    // ---- Line items ----
    lines: NoteLineItem[]
    setLines: (lines: NoteLineItem[]) => void

    // ---- Computed totals ----
    totalNet: number
    totalTax: number
    total: number

    // ---- Registration (DTE step) ----
    registration: RegistrationData
    setRegistration: (r: RegistrationData | ((prev: RegistrationData) => RegistrationData)) => void

    // ---- Payment ----
    payment: PaymentData
    setPayment: (p: PaymentData) => void

    // ---- Logistics (sales only) ----
    logisticsData: Record<string, unknown> | null
    setLogisticsData: (d: Record<string, unknown> | null) => void

    // ---- Period / folio validation ----
    isPeriodValid: boolean
    setIsPeriodValid: (v: boolean) => void

    // ---- Step sequencer ----
    currentStepId: NoteWizardStepId
    stepsSequence: NoteWizardStepId[]
    currentStepIndex: number   // 1-based
    totalStepsCount: number
    isLastStep: boolean
    canGoBack: boolean

    handleNext: () => Promise<void>
    handleBack: () => void

    /**
     * Builds the final payload and calls the caller's onSubmit.
     * Returns true on success, false on validation failure.
     */
    buildPayload: () => NoteWizardPayload

    // ---- Loading ----
    submitting: boolean
    setSubmitting: (v: boolean) => void
}

// ---------------------------------------------------------------------------
// Default registration state factory
// ---------------------------------------------------------------------------

const makeDefaultRegistration = (dateString: string | null): RegistrationData => ({
    documentNumber: '',
    documentDate: dateString ?? '',
    isPending: false,
    attachment: null,
})

const makeDefaultPayment = (amount = 0): PaymentData => ({
    method: null,
    amount,
    treasuryAccountId: null,
    paymentMethodId: null,
    isPending: false,
})

// ---------------------------------------------------------------------------
// Compute step sequence based on runtime state
// ---------------------------------------------------------------------------

function buildStepsSequence(
    mode: NoteWizardMode,
    features: Required<NoteWizardFeatures>,
    allowTypeChange: boolean,
    lines: NoteLineItem[],
    noteType: NoteType,
): NoteWizardStepId[] {
    const steps: NoteWizardStepId[] = []

    if (allowTypeChange) steps.push('type-selector')

    steps.push('items')

    if (
        features.manufacturing &&
        noteType === 'NOTA_DEBITO' &&
        lines.some(l => l.requiresAdvancedManufacturing || (l.productType === 'MANUFACTURABLE' && !l.hasBom))
    ) {
        steps.push('manufacturing')
    }

    if (
        features.logistics &&
        lines.some(l => l.createsStockMove || l.productType === 'MANUFACTURABLE' || l.hasBom)
    ) {
        steps.push('logistics')
    }

    steps.push('registration')

    if (features.reviewStep) steps.push('review')

    steps.push('payment')

    return steps
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useNoteWizardState({
    open,
    mode,
    initialType,
    allowTypeChange,
    features,
    serverDateString,
    fetchSource,
}: UseNoteWizardStateOptions): NoteWizardState {
    const [sourceDocument, setSourceDocument] = useState<NoteWizardSourceDocument | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    const [noteType, setNoteType] = useState<NoteType>(initialType)
    const [lines, setLines] = useState<NoteLineItem[]>([])
    const [registration, setRegistration] = useState<RegistrationData>(makeDefaultRegistration(serverDateString))
    const [payment, setPayment] = useState<PaymentData>(makeDefaultPayment())
    const [logisticsData, setLogisticsData] = useState<Record<string, unknown> | null>(null)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // ---- Step sequencer state ----
    // We track the current index into `stepsSequence` (which is recomputed whenever
    // the line selection changes — logistics / manufacturing steps appear / disappear).
    const [currentStepIndex0, setCurrentStepIndex0] = useState(0) // 0-based

    // ---- Reset on open ----
    useEffect(() => {
        if (!open) return

        let cancelled = false

        setInitializing(true)
        setCurrentStepIndex0(0)
        setNoteType(initialType)
        setLines([])
        setLogisticsData(null)
        setRegistration(makeDefaultRegistration(serverDateString))
        setPayment(makeDefaultPayment())
        setIsPeriodValid(true)
        setSourceDocument(null)

        fetchSource()
            .then((doc) => {
                if (cancelled) return
                setSourceDocument(doc)
                const mappedLines = doc.lines.map(line => ({
                    ...line,
                    noteQuantity: initialType === 'NOTA_CREDITO' ? 0 : line.noteQuantity
                }))
                setLines(mappedLines)
                setPayment(makeDefaultPayment(doc.originalTotal))
            })
            .catch((err: unknown) => {
                if (cancelled) return
                console.error('[NoteWizard] fetchSource error:', err)
                toast.error('Error al cargar los datos del documento original.')
            })
            .finally(() => {
                if (!cancelled) setInitializing(false)
            })

        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // ---- Sync server date into registration when it arrives late ----
    useEffect(() => {
        if (serverDateString && !registration.documentDate) {
            setRegistration(prev => ({ ...prev, documentDate: serverDateString }))
        }
    }, [serverDateString]) // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Computed totals ----
    const totalNet = useMemo(() => {
        if (mode === 'sales') {
            // Sales: quantity × unit_price (tax is computed separately per line)
            return lines.reduce((acc, l) => acc + l.noteQuantity * l.noteUnitPrice, 0)
        }
        // Purchase: quantity × unit_cost (net price already excludes tax)
        return lines.reduce((acc, l) => acc + l.noteQuantity * l.noteUnitPrice, 0)
    }, [lines, mode])

    const totalTax = useMemo(() => {
        if (mode === 'sales') {
            // Sales: tax is stored per-unit in taxAmountPerUnit (from original invoice)
            return lines.reduce((acc, l) => acc + l.noteQuantity * (l.taxAmountPerUnit ?? 0), 0)
        }
        // Purchase: derive tax from net using PricingUtils
        return PricingUtils.calculateTax(totalNet)
    }, [lines, mode, totalNet])

    const total = totalNet + totalTax

    // ---- Sync payment amount when totals change ----
    useEffect(() => {
        setPayment(prev => ({ ...prev, amount: total }))
    }, [total])

    // ---- Dynamic step sequence ----
    const stepsSequence = useMemo(
        () => buildStepsSequence(mode, features, allowTypeChange, lines, noteType),
        [mode, features, allowTypeChange, lines, noteType],
    )

    // Clamp index when sequence shrinks (e.g. logistics step disappears)
    const safeIndex = Math.min(currentStepIndex0, stepsSequence.length - 1)
    const currentStepId = stepsSequence[safeIndex]
    const isLastStep = safeIndex === stepsSequence.length - 1
    const canGoBack = safeIndex > 0

    // ---- Step validation ----
    const validateCurrentStep = useCallback((): boolean => {
        switch (currentStepId) {
            case 'type-selector':
                return true // always valid — noteType is always set

            case 'items': {
                const hasSelection = lines.some(l => l.noteQuantity > 0)
                if (!hasSelection) {
                    toast.error('Seleccione al menos un ítem (cantidad > 0).')
                    return false
                }
                if (totalNet <= 0) {
                    toast.error('El monto total debe ser mayor a 0.')
                    return false
                }
                return true
            }

            case 'manufacturing': {
                const pending = lines.filter(
                    l =>
                        (l.productType === 'MANUFACTURABLE' && l.requiresAdvancedManufacturing && !l.manufacturingData) ||
                        (l.productType === 'MANUFACTURABLE' && !l.hasBom && !l.manufacturingData),
                )
                if (pending.length > 0) {
                    toast.error(`${pending.length} producto(s) sin configurar detalles de fabricación.`)
                    return false
                }
                return true
            }

            case 'logistics':
                if (!logisticsData) {
                    toast.error('Complete la información de logística.')
                    return false
                }
                return true

            case 'registration':
                if (!registration.isPending) {
                    if (!registration.attachment) {
                        toast.error('El archivo adjunto es obligatorio.')
                        return false
                    }
                    if (!registration.documentNumber) {
                        toast.error('Ingrese el número de folio.')
                        return false
                    }
                    if (!isPeriodValid) {
                        toast.error('No se puede registrar. El periodo está cerrado.')
                        return false
                    }
                }
                return true

            case 'review':
                return true

            case 'payment':
                return true

            default:
                return true
        }
    }, [currentStepId, lines, totalNet, logisticsData, registration, isPeriodValid])

    const handleNext = useCallback(async () => {
        if (!validateCurrentStep()) return
        setCurrentStepIndex0(prev => Math.min(prev + 1, stepsSequence.length - 1))
    }, [validateCurrentStep, stepsSequence.length])

    const handleBack = useCallback(() => {
        setCurrentStepIndex0(prev => Math.max(prev - 1, 0))
    }, [])

    // ---- Build final payload ----
    const buildPayload = useCallback((): NoteWizardPayload => ({
        noteType,
        totalNet,
        totalTax,
        total,
        lines,
        registration,
        payment,
        logistics: logisticsData ?? undefined,
    }), [noteType, totalNet, totalTax, total, lines, registration, payment, logisticsData])

    return {
        sourceDocument,
        initializing,

        noteType,
        setNoteType,

        lines,
        setLines,

        totalNet,
        totalTax,
        total,

        registration,
        setRegistration,

        payment,
        setPayment,

        logisticsData,
        setLogisticsData,

        isPeriodValid,
        setIsPeriodValid,

        currentStepId,
        stepsSequence,
        currentStepIndex: safeIndex + 1,
        totalStepsCount: stepsSequence.length,
        isLastStep,
        canGoBack,

        handleNext,
        handleBack,
        buildPayload,

        submitting,
        setSubmitting,
    }
}
