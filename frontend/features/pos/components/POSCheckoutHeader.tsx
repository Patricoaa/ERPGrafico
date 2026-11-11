"use client"

import { usePOS } from "../contexts/POSProvider"
import { formatPlainDate } from "@/lib/utils"
import { getDteLabel } from "@/lib/entity-registry"
import type { WizardState } from "@/types/pos"
import * as Validation from "../utils/validation"
import { POSStepper } from "./flow/POSStepper"

const methodLabels: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    CREDIT_CARD: 'T. Crédito',
    DEBIT_CARD: 'T. Débito',
    TRANSFER: 'Transferencia',
    CREDIT: 'Crédito',
    CREDIT_BALANCE: 'Saldo',
    CHECK: 'Cheque',
    MERCADO_PAGO: 'M. Pago',
}

function getDeliveryLabel(type: string): string {
    switch (type) {
        case 'IMMEDIATE': return 'Inmediata'
        case 'PARTIAL': return 'Parcial'
        case 'SCHEDULED': return 'Programada'
        case 'LATER': return 'Programada'
        default: return type
    }
}

function getStepMetadata(stepLabel: string, wizardState: WizardState | null, itemsCount: number): string | null {
    if (!wizardState) return null
    switch (stepLabel) {
        case 'Cliente':
            return wizardState.selectedCustomerName || null
        case 'Documento':
            return wizardState.dteData?.type ? getDteLabel(wizardState.dteData.type) : null
        case 'Entrega': {
            const dd = wizardState.deliveryData
            if (!dd?.type) return null
            const label = getDeliveryLabel(dd.type)
            const date = dd.date ? formatPlainDate(dd.date) : null
            return date ? `${date} (${label})` : label
        }
        case 'Carrito':
            return `${itemsCount} ${itemsCount === 1 ? 'artículo' : 'artículos'}`
        case 'Pago':
            return wizardState.paymentData?.method ? methodLabels[wizardState.paymentData.method] || wizardState.paymentData.method : null
        default:
            return null
    }
}

/**
 * Progreso de la venta (Carrito → Cliente → Documento → [Fabricación] → Entrega → Pago) con el mismo
 * `POSStepper` de la apertura y el cierre; los pasos hechos muestran lo elegido.
 */
export function POSCheckoutHeader() {
    const { posMode, wizardState, items } = usePOS()

    const currentStep = posMode === 'SHOPPING' ? 1 : (wizardState?.step ?? 1) + 1
    // Mirrors SalesCheckoutWizardView steps + leading 'Carrito'
    const labels = ['Carrito', 'Cliente', 'Documento']
    if (Validation.requiresManufacturingStep(items)) labels.push('Fabricación')
    labels.push('Entrega', 'Pago')

    return (
        <POSStepper
            label="Progreso de la venta"
            current={currentStep - 1}
            steps={labels.map((label, i) => ({
                id: label,
                label,
                meta: i < currentStep - 1 ? getStepMetadata(label, wizardState, items.length) : null,
            }))}
        />
    )
}
