"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { UnifiedNoteWizard, type NoteType } from "@/features/notes"
import { useSalesNoteWizardAdapter } from "@/features/billing"

const Step2_ManufacturingDetails = dynamic(
    () => import("@/features/sales").then(m => m.Step2_ManufacturingDetails),
    { ssr: false },
)

/** Sales-owned manufacturing step injected into the notes wizard (notes must not import sales). */
function SalesManufacturingStep({ lines, setLines }: { lines: unknown[]; setLines: (lines: unknown[]) => void }) {
    return (
        <Suspense fallback={<div />}>
            <Step2_ManufacturingDetails
                orderLines={lines as never}
                setOrderLines={setLines as never}
            />
        </Suspense>
    )
}

interface OrderNoteWizardProps {
    /** Por defecto abierto (se monta solo mientras se usa); la pestaña lo conmuta al cambiar de pestaña. */
    open?: boolean
    noteType: NoteType
    /** Factura POSTED (no nota) sobre la que se emite la NC/ND */
    invoiceId: number | null
    referenceLabel?: string
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Cableado de venta del wizard de notas: factura origen vía adaptador de
 * billing + paso de fabricación inyectado desde sales.
 */
export function OrderNoteWizard({ open = true, noteType, invoiceId, referenceLabel, onOpenChange, onSuccess }: OrderNoteWizardProps) {
    const { fetchSource, onSubmit } = useSalesNoteWizardAdapter(invoiceId)

    return (
        <UnifiedNoteWizard
            open={open}
            onOpenChange={onOpenChange}
            mode="sales"
            initialType={noteType}
            features={{ logistics: true, manufacturing: true }}
            renderManufacturingStep={({ lines, setLines }) => (
                <SalesManufacturingStep lines={lines as unknown[]} setLines={setLines as (l: unknown[]) => void} />
            )}
            referenceLabel={referenceLabel}
            fetchSource={fetchSource}
            onSubmit={onSubmit}
            onSuccess={onSuccess}
        />
    )
}
