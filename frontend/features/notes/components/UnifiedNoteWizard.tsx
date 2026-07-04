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
import { ChevronLeft, ChevronRight, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

import { Drawer, ActionSlideButton, Chip, SkeletonShell } from '@/components/shared'

// Shared steps
import {
    NoteStep_TypeSelector,
    NoteStep_LineItems,
    NoteStep_Registration,
    NoteStep_Review,
    NoteStep_Payment,
} from './steps'

// Sales-only steps (stay in their feature, imported directly)
import { Step2_Logistics } from '@/features/billing/components/checkout/Step2_Logistics'
import { Step2_ManufacturingDetails } from '@/features/sales/components/checkout/Step2_ManufacturingDetails'

// Sidebars (each feature keeps its own)
import { NoteProcessSidebar } from '@/features/billing/components/checkout/NoteProcessSidebar'
import { NoteItemsSummary } from '@/features/billing/components/checkout/NoteItemsSummary'
import { PurchaseNoteSummarySidebar } from '@/features/purchasing/components/notes/PurchaseNoteSummarySidebar'

// Hook + types
import { useNoteWizardState } from '../hooks/useNoteWizardState'
import { useServerDate } from '@/hooks/useServerDate'
import type {
    NoteType,
    NoteWizardFeatures,
    NoteWizardMode,
    NoteWizardPayload,
    NoteWizardSourceDocument,
} from '../types'
import type { SaleOrderLine } from '@/features/sales/types'

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
        isPeriodValid,
        setIsPeriodValid,
        currentStepId,
        stepsSequence,
        currentStepIndex,
        totalStepsCount,
        isLastStep,
        canGoBack,
        handleNext,
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
                        <NoteStep_LineItems
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
                    <NoteStep_LineItems
                        selectionMode="edit"
                        noteType={noteType}
                        lines={lines}
                        selectedLines={lines.filter(l => l.noteQuantity > 0)}
                        onLinesChange={setLines}
                    />
                )

            case 'manufacturing':
                return (
                    <Step2_ManufacturingDetails
                        // Step2_ManufacturingDetails expects SaleOrderLine[] shape
                        orderLines={lines as unknown as SaleOrderLine[]}
                        setOrderLines={setLines as unknown as (lines: SaleOrderLine[]) => void}
                    />
                )

            case 'logistics':
                return (
                    <Step2_Logistics
                        isCreditNote={isCreditNote}
                        data={logisticsData as Record<string, unknown>}
                        setData={setLogisticsData}
                        selectedItems={lines as unknown as Record<string, unknown>[]}
                    />
                )

            case 'registration':
                return (
                    <NoteStep_Registration
                        isCreditNote={isCreditNote}
                        noteType={noteType}
                        data={registration}
                        setData={setRegistration}
                        onPeriodValidityChange={setIsPeriodValid}
                    />
                )

            case 'review':
                return (
                    <NoteStep_Review
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
                    <NoteStep_Payment
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
    const nextDisabled =
        submitting ||
        initializing ||
        (currentStepId === 'registration' && !registration.isPending && !isPeriodValid)

    return (
        <Drawer
            open={open}
            onOpenChange={(val) => !(submitting || initializing) && onOpenChange(val)}
            side="right"
            defaultSize="100%"
            boundary="screen"
            contentClassName="p-0 flex flex-col"
            headerClassName="border-b pb-2 px-6 py-3"
            icon={FileText}
            title={
                <div className="flex items-center gap-3">
                    <span>{title}</span>
                    {isExempt && <Chip intent="success" size="sm" className="h-6">Documento Exento</Chip>}
                    {referenceLabel && (
                        <Chip intent="neutral" size="sm" className="h-6 font-mono font-bold tracking-widest text-[10px] uppercase">
                            Ref: {referenceLabel}
                        </Chip>
                    )}
                </div>
            }
            description={
                noteType === 'NOTA_CREDITO' 
                    ? 'Asistente de emisión de Notas de Crédito, devoluciones y logística inversa.'
                    : 'Asistente de emisión de Notas de Débito y cargos adicionales.'
            }
            footer={
                <div className="w-full flex justify-between items-center">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={!canGoBack || submitting || initializing}
                        className="h-12 px-6 font-bold"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Atrás
                    </Button>

                    {!isLastStep ? (
                        <Button
                            onClick={handleNext}
                            className="w-40 h-12 font-bold shadow-elevated transition-all"
                            disabled={nextDisabled}
                        >
                            {(submitting || initializing) && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Siguiente
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <ActionSlideButton
                            onClick={handleFinish}
                            className="w-48 h-12 bg-success hover:bg-success font-bold shadow-elevated transition-all"
                            loading={submitting}
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Finalizar Proceso
                        </ActionSlideButton>
                    )}
                </div>
            }
        >
            <div className="flex flex-1 overflow-hidden relative h-full">
                {/* ---- Left Sidebar ---- */}
                {!initializing && (
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
                )}

                {/* ---- Center Content ---- */}
                <div className="flex-1 flex flex-col min-w-0 h-full relative border-r">
                    <div className="flex-1 p-10 overflow-y-auto bg-background custom-scrollbar flex flex-col">
                        <div className="w-full flex-1 flex flex-col">
                            {renderStep()}
                        </div>
                    </div>
                </div>

                {/* ---- Right Sidebar (sales only) ---- */}
                {mode === 'sales' && !initializing && (
                    <div className="w-80 hidden lg:block overflow-hidden relative">
                        <NoteItemsSummary
                            items={lines}
                            totalNet={totalNet}
                            totalTax={totalTax}
                            total={total}
                            isExempt={isExempt}
                        />
                    </div>
                )}
            </div>
        </Drawer>
    )
}
