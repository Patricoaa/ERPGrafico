"use client"

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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { PricingUtils } from '@/lib/pricing-utils'
import { useVatRate } from '@/hooks/useVatRate'
import type {
    NoteLineItem,
    NoteLogisticsData,
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
    pickedFiscalMatchId?: number | null
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
    logisticsData: NoteLogisticsData | null
    setLogisticsData: (d: NoteLogisticsData | null) => void

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
    /** Runs the per-step validation (shows a toast and returns false when blocked). */
    validateCurrentStep: () => boolean

    handleNext: () => Promise<void>
    handleBack: () => void
    /**
     * Salto desde el rail de pasos (índice 0-based). Retroceder es libre;
     * avanzar solo se permite un paso y pasa por la validación del actual.
     */
    goToStep: (index0: number) => void

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
    const { rate: vatRate } = useVatRate()
    const [sourceDocument, setSourceDocument] = useState<NoteWizardSourceDocument | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    const [noteType, setNoteType] = useState<NoteType>(initialType)
    const [lines, setLines] = useState<NoteLineItem[]>([])
    const [registrationState, setRegistrationState] = useState<RegistrationData>(makeDefaultRegistration(serverDateString))
    const [paymentState, setPaymentState] = useState<PaymentData>(makeDefaultPayment())
    const [logisticsData, setLogisticsData] = useState<NoteLogisticsData | null>(null)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // ---- Step sequencer state ----
    // We track the current index into `stepsSequence` (which is recomputed whenever
    // the line selection changes — logistics / manufacturing steps appear / disappear).
    const [currentStepIndex0, setCurrentStepIndex0] = useState(0) // 0-based

    // ---- Init (once per mount, on first open) ----
    // El wizard puede vivir como pestaña montada que se oculta/muestra (`open` conmuta al cambiar de
    // pestaña): reabrir no debe perder lo ingresado ni volver a pedir el documento origen.
    const initialized = useRef(false)
    const alive = useRef(true)

    useEffect(() => {
        alive.current = true
        return () => { alive.current = false }
    }, [])

    useEffect(() => {
        if (!open || initialized.current) return
        initialized.current = true

        fetchSource()
            .then((doc) => {
                if (!alive.current) return
                setSourceDocument(doc)
                const mappedLines = doc.lines.map(line => ({
                    ...line,
                    noteQuantity: initialType === 'NOTA_CREDITO' ? 0 : line.noteQuantity
                }))
                setLines(mappedLines)
                setPaymentState(makeDefaultPayment(doc.originalTotal))
            })
            .catch((err: unknown) => {
                if (!alive.current) return
                console.error('[NoteWizard] fetchSource error:', err)
                toast.error('Error al cargar los datos del documento original.')
            })
            .finally(() => {
                if (alive.current) setInitializing(false)
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

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
        return PricingUtils.calculateTax(totalNet, vatRate / 100)
    }, [lines, mode, totalNet, vatRate])

    const total = totalNet + totalTax

    // ---- Derived registration — syncs serverDateString during render ----
    const registration = useMemo(() =>
        serverDateString && !registrationState.documentDate
            ? { ...registrationState, documentDate: serverDateString }
            : registrationState
    , [registrationState, serverDateString])

    // ---- Derived payment — amount always equals computed total ----
    const payment = useMemo(() => ({ ...paymentState, amount: total }), [paymentState, total])

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
                if (registration.pickedFiscalMatchId) {
                    return true
                }
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

    const goToStep = useCallback((index0: number) => {
        if (index0 === safeIndex) return
        if (index0 < safeIndex) {
            setCurrentStepIndex0(Math.max(index0, 0))
        } else if (index0 === safeIndex + 1 && validateCurrentStep()) {
            setCurrentStepIndex0(Math.min(index0, stepsSequence.length - 1))
        }
    }, [safeIndex, validateCurrentStep, stepsSequence.length])

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
        setRegistration: setRegistrationState,

        payment,
        setPayment: setPaymentState,

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
        validateCurrentStep,

        handleNext,
        handleBack,
        goToStep,
        buildPayload,

        submitting,
        setSubmitting,
    }
}
