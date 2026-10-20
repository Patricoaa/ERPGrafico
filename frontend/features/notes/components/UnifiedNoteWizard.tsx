"use client"

/**
 * UnifiedNoteWizard
 *
 * Single wizard component that handles both Sales and Purchase note flows.
 *
 * Sales  (mode='sales'):
 *   Sequence: items → [manufacturing] → [logistics] → registration → payment
 *   Sidebar left:  NoteProcessSidebar  (steps + manufacturing/logistics flags)
 *   Sidebar right: NoteItemsSummary    (selected items + totals)
 *
 * Purchase (mode='purchase'):
 *   Sequence: type-selector → items → registration → review → payment
 *   Sidebar left:  PurchaseNoteSummarySidebar (totals + supplier info)
 *   Sidebar right: none
 *
 * The wizard itself owns NO API logic. Callers inject:
 *   fetchSource  — async function that returns NoteWizardSourceDocument
 *   onSubmit     — async function that receives NoteWizardPayload
 */

import { showApiError } from '@/lib/errors'
import { toast } from 'sonner'

import { Chip, GenericWizard, SkeletonShell, type WizardStep } from "@/components/shared"
import { Button } from "@/components/ui/button"

// Shared steps
import {
    NoteStep_TypeSelector,
    NoteLineItemsStep,
    NoteRegistrationStep,
    NoteReviewStep,
    NotePaymentStep,
    NoteStep_Logistics,
} from './steps'

// Note-owned sidebars (moved here from billing / purchasing so notes has no
// cross-feature imports).
import { NoteProcessSidebar } from './sidebars/NoteProcessSidebar'
import { NoteItemsSummary } from './sidebars/NoteItemsSummary'
import { PurchaseNoteSummarySidebar } from './sidebars/PurchaseNoteSummarySidebar'

// Shared shell
import { FileText } from 'lucide-react'

// Hook + types
import { useNoteWizardState } from '../hooks/useNoteWizardState'
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
    warehouseName,
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
        canGoBack,
        handleBack,
        buildPayload,
        submitting,
        setSubmitting,
    } = state

    // ---- Derived flags (for sidebars & step routing) ----
    const requiresLogistics =
        features.logistics &&
        lines.some(l => l.createsStockMove || l.productType === 'MANUFACTURABLE' || l.hasBom)

    const hasManufacturing =
        features.manufacturing &&
        noteType === 'NOTA_DEBITO' &&
        lines.some(l => l.requiresAdvancedManufacturing || (l.productType === 'MANUFACTURABLE' && !l.hasBom))

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
                <div className="h-[400px]">
                    <SkeletonShell isLoading ariaLabel="Cargando wizard de nota">
                        <div className="p-6" />
                    </SkeletonShell>
                </div>
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
                    <NoteStep_Logistics
                        isCreditNote={isCreditNote}
                        data={logisticsData as Record<string, unknown>}
                        setData={setLogisticsData}
                        selectedItems={lines as unknown as Record<string, unknown>[]}
                    />
                )

            case 'registration':
                return (
                    <NoteRegistrationStep
                        isCreditNote={isCreditNote}
                        noteType={noteType}
                        data={registration}
                        setData={setRegistration}
                        onPeriodValidityChange={setIsPeriodValid}
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

    // ---- Next button disabled logic ----

    // The hook owns the step machine (dynamic sequence + per-step validation).
    // GenericWizard mirrors the hook index through `initialStep`; its own
    // navigation is replaced by a footer that delegates back to the hook, so
    // there is exactly one source of truth.
    const wizardSteps: WizardStep[] = stepsSequence.map((id, index) => ({
        id,
        title: STEP_LABELS[id] ?? id,
        component: index === currentStepIndex - 1 ? renderStep() : null,
        isValid: !(submitting || initializing),
    }))

    const leftSidebar = !initializing && (
        mode === 'sales' ? (
            <NoteProcessSidebar
                currentStep={currentStepIndex}
                totalSteps={totalStepsCount}
                noteType={noteType}
                requiresLogistics={requiresLogistics}
                hasManufacturing={hasManufacturing}
                itemsCount={lines.length}
                dteNumber={registration.documentNumber || undefined}
                paymentData={{
                    method: String(payment.method ?? ''),
                    amount: payment.amount,
                }}
            />
        ) : (
            <PurchaseNoteSummarySidebar
                currentStep={currentStepIndex}
                totalSteps={totalStepsCount}
                orderNumber={orderReference}
                referenceText={referenceLabel}
                supplierName={supplierName}
                warehouseName={warehouseName}
                noteType={noteType}
                totals={{ net: totalNet, tax: totalTax, total }}
                isProcessing={submitting}
            />
        )
    )

    const rightSidebar = mode === 'sales' && !initializing ? (
        <NoteItemsSummary
            items={lines}
            totalNet={totalNet}
            totalTax={totalTax}
            total={total}
            isExempt={isExempt}
        />
    ) : undefined

    return (
        <GenericWizard
            open={open}
            onOpenChange={(val) => !(submitting || initializing) && onOpenChange(val)}
            onClose={() => onOpenChange(false)}
            surface="drawer"
            drawerSide="bottom"
            drawerBoundary="embedded"
            hideScrollArea
            icon={FileText}
            title={
                <div className="flex items-center gap-3">
                    <span>{title}</span>
                    {isExempt && <Chip intent="success" size="sm">Documento Exento</Chip>}
                    {referenceLabel && (
                        <Chip intent="neutral" size="sm" className="font-mono">
                            Ref: {referenceLabel}
                        </Chip>
                    )}
                </div>
            }
            subtitle={
                noteType === 'NOTA_CREDITO'
                    ? 'Asistente de emisión de Notas de Crédito, devoluciones y logística inversa.'
                    : 'Asistente de emisión de Notas de Débito y cargos adicionales.'
            }
            steps={wizardSteps}
            initialStep={Math.max(currentStepIndex - 1, 0)}
            onComplete={handleFinish}
            isCompleting={submitting}
            isLoading={initializing}
            completeButtonLabel="Finalizar Proceso"
            footerLeft={
                canGoBack ? (
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={submitting || initializing}
                        className="h-12 px-6 font-medium"
                    >
                        Atrás
                    </Button>
                ) : undefined
            }
            leftSidebar={leftSidebar}
            rightSidebar={rightSidebar}
            contentClassName="p-10 custom-scrollbar"
        />
    )
}
