"use client"

import { useMemo } from "react"
import { WizardSummarySidebar, ManufacturingSpecsPanel, type ManufacturingSpecsView } from "@/components/shared"
import type { WorkOrder } from "../types"
import { useUoMs } from "../hooks"
import { useWizardStore } from "./WorkOrderWizardStore"

interface WizardRightSidebarProps {
    order: WorkOrder
    productName: string
    stageData: WorkOrder['stage_data']
}

/** Maps the persisted work order onto the shared specs projection. */
export function workOrderSpecsView(order: WorkOrder, productName: string, stageData: WorkOrder['stage_data']): ManufacturingSpecsView {
    const designFiles = stageData?.design_attachments ?? []
    return {
        product: {
            name: productName,
            quantity: order.quantity ?? stageData?.quantity ?? null,
            uomName: order.uom_name ?? stageData?.uom_name ?? null,
        },
        productDescription: stageData?.product_description || order.product_description,
        customer: order.sale_customer_name
            ? { name: order.sale_customer_name, taxId: order.sale_customer_rut }
            : null,
        contact: stageData?.contact_name
            ? { name: stageData.contact_name, taxId: stageData.contact_tax_id }
            : null,
        phases: stageData?.phases,
        specifications: {
            prepress: stageData?.prepress_specs,
            press: stageData?.press_specs,
            postpress: stageData?.postpress_specs,
        },
        designNeeded: stageData?.design_needed,
        designFiles,
        folioEnabled: stageData?.folio_enabled,
        folioStart: stageData?.folio_start,
        printType: (stageData?.print_type ?? null) as ManufacturingSpecsView['printType'],
        createdAt: order.created_at ?? order.start_date ?? null,
        requestedDelivery: order.sale_order_delivery_date ? String(order.sale_order_delivery_date) : null,
    }
}

/** Right rail shown while the work order is still being configured (nothing persisted yet). */
export function WizardDraftSidebar() {
    const { mfgConfig, selectedContact, productDescription, quantity, uomId } = useWizardStore()
    const { data: uoms = [] } = useUoMs()
    const uomName = uoms.find(u => String(u.id) === uomId)?.name ?? null
    const view = useMemo<ManufacturingSpecsView>(() => ({
        product: { name: productDescription || 'Producto', quantity: quantity || null, uomName },
        productDescription: mfgConfig?.product_description,
        contact: selectedContact ? { name: selectedContact.name, taxId: selectedContact.tax_id } : null,
        phases: mfgConfig?.phases,
        specifications: mfgConfig?.specifications,
        designNeeded: mfgConfig?.design_needed,
        designFiles: [...(mfgConfig?.existing_design_files ?? []), ...(mfgConfig?.design_files.map(f => f.name) ?? [])],
        folioEnabled: mfgConfig?.folio_enabled,
        folioStart: mfgConfig?.folio_start,
        printType: mfgConfig?.print_type,
    }), [mfgConfig, selectedContact, productDescription, quantity, uomName])
    return <SpecsRail view={view} />
}

function SpecsRail({ view }: { view: ManufacturingSpecsView }) {
    return (
        <WizardSummarySidebar
            side="right"
            width="w-72"
            className="hidden lg:flex self-stretch h-auto"
            scrollAreaClassName="min-h-0"
            body={
                <>
                    <ManufacturingSpecsPanel view={view} />
                </>
            }
        />
    )
}

export function WizardRightSidebar({ order, productName, stageData }: WizardRightSidebarProps) {
    const view = useMemo(() => workOrderSpecsView(order, productName, stageData), [order, productName, stageData])
    return <SpecsRail view={view} />
}
