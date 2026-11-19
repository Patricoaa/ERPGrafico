"use client"

/**
 * UnifiedNoteWizard
 *
 * Single wizard component that handles both Sales and Purchase note flows.
 *
 * Surface: `Drawer` bottom/embedded a pantalla completa + `DrawerLayout`, el
 * mismo patrón que `PurchaseCheckoutWizard`. El hook `useNoteWizardState` es la
 * única fuente de verdad del paso (secuencia dinámica + validación).
 *
 * Sales  (mode='sales'):
 *   Sequence: items → [manufacturing] → [logistics] → registration → payment
 * Purchase (mode='purchase'):
 *   Sequence: type-selector → items → registration → review → payment
 *
 * Rail izquierdo: NoteProcessSidebar (redimensionable, colapsable, clicable).
 * Rail derecho:   NoteItemsSummary   (ítems + totales, colapsable).
 *
 * The wizard itself owns NO API logic. Callers inject:
 *   fetchSource  — async function that returns NoteWizardSourceDocument
 *   onSubmit     — async function that receives NoteWizardPayload
 */

import { showApiError } from '@/lib/errors'
import { toast } from 'sonner'
import { CheckCircle2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

import { CancelButton, Chip, Drawer, DrawerLayout, SkeletonShell, SubmitButton } from "@/components/shared"

// Shared steps
import {
    NoteStep_TypeSelector,
    NoteLineItemsStep,
    NoteRegistrationStep,
    NoteReviewStep,
    NotePaymentStep,
    NoteLogisticsStep,
} from './steps'

import { NoteProcessSidebar } from './sidebars/NoteProcessSidebar'
import { NoteItemsSummary } from './sidebars/NoteItemsSummary'

// Hook + types
import { useNoteWizardState } from '../hooks/useNoteWizardState'
import { useRailCollapsed } from '../hooks/useRailCollapsed'
import { useServerDate } from '@/hooks/useServerDate'
import type {
    NoteLineItem,
    NoteType,
    NoteWizardFeatures,
    NoteWizardMode,
    NoteWizardPayload,
    NoteWizardSourceDocument,
} from '../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UnifiedNoteWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void

    /** Drives which sidebar, step sequence, and labels to use */
    mode: NoteWizardMode

    /** Pre-selected note type. In purchase flow with allowTypeChange=true, used as initial value only */
    initialType: NoteType

    /** If true, a TypeSelector step is prepended (purchase flow default) */
    allowTypeChange?: boolean

    /** Which optional steps to enable */
    features?: NoteWizardFeatures

    /**
     * Loads the source document data (called on `open`).
     * Each callsite provides its own implementation pointing to its API.
     */
    fetchSource: () => Promise<NoteWizardSourceDocument>

    /**
     * Called with the final payload on wizard completion.
     * Should throw on API error (wizard catches and shows toast).
     */
    onSubmit: (payload: NoteWizardPayload) => Promise<void>

    onSuccess?: () => void

    /** Displayed next to the title, e.g. "FACTURA ELECTRONICA 45223" */
    referenceLabel?: string

    /** Additional context for purchase sidebar */
    supplierName?: string
    warehouseName?: string
    orderReference?: string

    /**
     * Manufacturing step slot. Sales-owned callers inject
     * `Step2_ManufacturingDetails` here so `notes` never imports `sales`.
     * Only required when `features.manufacturing` is enabled and the flow
     * reaches the manufacturing step.
     */
    renderManufacturingStep?: (ctx: {
        lines: NoteLineItem[]
        setLines: (lines: NoteLineItem[]) => void
    }) => React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Human labels for the dynamic step sequence, used by the wizard counter and
 * the render context. Kept in sync with `buildStepsSequence`.
 */
const STEP_LABELS: Record<string, string> = {
    'type-selector': 'Tipo de Nota',
    items: 'Productos',
    manufacturing: 'Fabricación',
    logistics: 'Logística',
    registration: 'Registro',
    review: 'Revisión',
    payment: 'Pago',
}

const RAIL_COLLAPSED_STORAGE_KEY = 'erpgrafico.notes.railCollapsed'

export function UnifiedNoteWizard({
    open,
    onOpenChange,
    mode,
    initialType,
    allowTypeChange = false,
    features: featuresProp = {},
    fetchSource,
    onSubmit,
    onSuccess,
    referenceLabel,
    supplierName,
    orderReference,
    renderManufacturingStep,
}: UnifiedNoteWizardProps) {
    const { dateString } = useServerDate()

    const features = {
        logistics: featuresProp.logistics ?? false,
        manufacturing: featuresProp.manufacturing ?? false,
        reviewStep: featuresProp.reviewStep ?? false,
    }

    const state = useNoteWizardState({
        open,
        mode,
        initialType,
        allowTypeChange,
        features,
        serverDateString: dateString,
        fetchSource,
    })

    const {
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
        setIsPeriodValid,
        currentStepId,
        stepsSequence,
        currentStepIndex,
        totalStepsCount,
        isLastStep,
        handleNext,
        handleBack,
        goToStep,
        buildPayload,
        submitting,
        setSubmitting,
    } = state

    // ---- Derived flags ----
    const isCreditNote = noteType === 'NOTA_CREDITO'
    const isExempt = sourceDocument?.isExempt ?? false

    // ---- Submit ----
    const handleFinish = async () => {
        setSubmitting(true)
        try {
            const payload = buildPayload()
            await onSubmit(payload)
            toast.success('Nota generada exitosamente.')
            onSuccess?.()
            onOpenChange(false)
        } catch (err: unknown) {
            showApiError(err, 'Error al finalizar el proceso.')
        } finally {
            setSubmitting(false)
        }
    }

    // ---- Title ----
    const title = isCreditNote ? 'Emitir Nota de Crédito' : 'Emitir Nota de Débito'

    // ---- Step content ----
    const renderStep = () => {
        if (initializing) {
            return (
                <SkeletonShell isLoading ariaLabel="Cargando datos del documento" className="space-y-4">
                    <div className="h-10 w-1/3 rounded-md bg-muted" />
                    <div className="h-32 rounded-md bg-muted" />
                    <div className="h-20 rounded-md bg-muted" />
                </SkeletonShell>
            )
        }

        switch (currentStepId) {
            case 'type-selector':
                return (
                    <NoteStep_TypeSelector
                        noteType={noteType}
                        onNoteTypeChange={setNoteType}
                    />
                )

            case 'items':
                if (mode === 'sales') {
                    return (
                        <NoteLineItemsStep
                            selectionMode="select"
                            noteType={noteType}
                            lines={sourceDocument?.lines ?? []}
                            selectedLines={lines}
                            onLinesChange={setLines}
                            isExempt={isExempt}
                        />
                    )
                }
                return (
                    <NoteLineItemsStep
                        selectionMode="edit"
                        noteType={noteType}
                        lines={lines}
                        selectedLines={lines.filter(l => l.noteQuantity > 0)}
                        onLinesChange={setLines}
                    />
                )

            case 'manufacturing':
                return renderManufacturingStep
                    ? renderManufacturingStep({ lines, setLines })
                    : <div className="text-sm text-muted-foreground">Etapa de fabricación no configurada.</div>

            case 'logistics':
                return (
                    <NoteLogisticsStep
                        isCreditNote={isCreditNote}
                        data={logisticsData}
                        setData={setLogisticsData}
                        selectedItems={lines}
                    />
                )

            case 'registration':
                return (
                    <NoteRegistrationStep
                        noteType={noteType}
                        data={registration}
                        setData={setRegistration}
                        onPeriodValidityChange={setIsPeriodValid}
                        direction={mode === 'sales' ? 'sale' : 'purchase'}
                        counterpartyRut={sourceDocument?.counterpartyRut}
                        total={total}
                        invoiceId={sourceDocument?.invoiceId}
                    />
                )

            case 'review':
                return (
                    <NoteReviewStep
                        noteType={noteType}
                        registration={registration}
                        lines={lines.filter(l => l.noteQuantity > 0)}
                        totalNet={totalNet}
                        totalTax={totalTax}
                        total={total}
                    />
                )

            case 'payment':
                return (
                    <NotePaymentStep
                        mode={mode}
                        noteType={noteType}
                        total={total}
                        paymentData={payment}
                        setPaymentData={setPayment}
                    />
                )

            default:
                return null
        }
    }

    // ---- Layout ----
    const { collapsed: railCollapsed, toggle: toggleRail } = useRailCollapsed(RAIL_COLLAPSED_STORAGE_KEY)
    const busy = submitting || initializing
    const stepLabel = STEP_LABELS[currentStepId] ?? currentStepId
    const counterpartyName = supplierName ?? sourceDocument?.counterpartyName

    const content = (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6">
            {renderStep()}
        </div>
    )

    return (
        <Drawer
            open={open}
            onOpenChange={(val) => { if (!busy) onOpenChange(val) }}
            side="bottom"
            boundary="embedded"
            defaultSize="100%"
            resizable={false}
            fillContent
            contentClassName="p-0 flex flex-col overflow-hidden bg-card"
            icon={FileText}
            title={title}
            subtitle={
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-bold text-primary">
                        {String(currentStepIndex).padStart(2, '0')} / {String(totalStepsCount).padStart(2, '0')}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">{stepLabel}</span>
                    {counterpartyName && (
                        <>
                            <span>·</span>
                            <span className="truncate">{counterpartyName}</span>
                        </>
                    )}
                </div>
            }
            headerActions={
                <div className="flex items-center gap-2">
                    {isExempt && <Chip intent="success" size="sm">Documento Exento</Chip>}
                    {(referenceLabel ?? sourceDocument?.label ?? orderReference) && (
                        <Chip intent="neutral" size="sm" className="font-mono">
                            Ref: {referenceLabel ?? sourceDocument?.label ?? orderReference}
                        </Chip>
                    )}
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    {currentStepIndex > 1 ? (
                        <CancelButton onClick={handleBack} disabled={busy}>
                            <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                            Atrás
                        </CancelButton>
                    ) : (
                        <CancelButton onClick={() => onOpenChange(false)} disabled={busy}>
                            Cancelar
                        </CancelButton>
                    )}
                    {isLastStep ? (
                        <SubmitButton
                            onClick={handleFinish}
                            disabled={busy}
                            loading={submitting}
                            icon={CheckCircle2}
                            className="bg-success hover:bg-success/90 text-success-foreground"
                        >
                            {isCreditNote ? 'Emitir Nota de Crédito' : 'Emitir Nota de Débito'}
                        </SubmitButton>
                    ) : (
                        <SubmitButton onClick={handleNext} disabled={busy} icon={ChevronRight}>
                            Siguiente
                        </SubmitButton>
                    )}
                </div>
            }
        >
            <DrawerLayout
                leftRail={!initializing && (
                    <NoteProcessSidebar
                        stepsSequence={stepsSequence}
                        currentStep={currentStepIndex}
                        noteType={noteType}
                        itemsCount={lines.filter(l => l.noteQuantity > 0).length}
                        dteNumber={registration.documentNumber || undefined}
                        paymentData={payment.method ? { method: String(payment.method), amount: payment.amount } : undefined}
                        collapsed={railCollapsed}
                        onToggleCollapsed={toggleRail}
                        onStepClick={goToStep}
                    />
                )}
                leftRailRaw
                leftRailWidth={railCollapsed ? "w-14" : "w-64"}
                noPadding
                rightRail={!initializing && (
                    <NoteItemsSummary
                        items={lines}
                        totalNet={totalNet}
                        totalTax={totalTax}
                        total={total}
                        isExempt={isExempt}
                    />
                )}
                rightRailCollapsible
                rightRailStorageKey="erpgrafico.drawer.sidebar.note_wizard"
                rightRailWidth="w-80"
            >
                {content}
            </DrawerLayout>
        </Drawer>
    )
}
