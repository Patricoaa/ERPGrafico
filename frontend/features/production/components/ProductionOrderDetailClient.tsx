"use client"
import { formatPlainDate } from "@/lib/utils";

import React, { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, CancelButton, ActionSlideButton, SkeletonShell } from "@/components/shared"
import type { WorkOrder, StageId } from "@/features/production/types"
import { WorkOrderWizard, useWorkOrder } from "@/features/production"
import { translateProductionStage } from "@/lib/utils"
import { formatEntityDisplay } from "@/lib/entity-registry"

// Placeholder tipado para el esqueleto - sigue el patrón del contrato
const WORK_ORDER_SKELETON: WorkOrder = {
    id: 0,
    display_id: "————————————",
    number: "————————————",
    main_product_id: 0,
    product_name: "————————————",
    status: "draft",
    current_stage: "BASIC_INFO",
    requires_prepress: false,
    requires_press: false,
    requires_postpress: false,
    is_manual: false,
    description: "————————————",
    product_description: "————————————",
    specifications: "————————————",
    specifications_prepress: "————————————",
    specifications_press: "————————————",
    specifications_postpress: "————————————",
    prepress_archive: "————————————",
    start_date: "",
    sale_order_delivery_date: "",
    sale_customer_name: "————————————",
    sale_customer_rut: "————————————",
    sale_order_date: "",
    sale_order_number: null,
    due_date: "",
    outsourcing_status: "none",
    warehouse_name: "————————————",
    materials: [],
    workflow_tasks: [],
    stage_data: null,
    product: {
        id: 0,
        name: "————————————",
        track_inventory: true,
        requires_bom_validation: false,
        uom: {
            name: "————————————"
        }
    },
    sale_line: null,
    sale_order: null,
    total_price: 0,
    created_at: "",
    checkout_files: [],
    attachments: [],
    production_discrepancy: null
}

interface ProductionOrderDetailClientProps {
    orderId: string
}

export function ProductionOrderDetailClient({ orderId }: ProductionOrderDetailClientProps) {
    const router = useRouter()
    const [wizardOpen, setWizardOpen] = useState(false)
    const [targetStage, setTargetStage] = useState<StageId | 'BASIC_INFO' | undefined>(undefined)

    const { order, isLoading: loading, error: queryError, refetch: fetchOrder } = useWorkOrder(orderId)

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar OT
        </div>
    )

    if (loading || !order) {
         return (
             <div className="flex-1 p-8">
                 <SkeletonShell isLoading={loading || !order} ariaLabel="Cargando orden de producción" />
             </div>
         )
     }

    const isEditable = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage)

    return (
        <EntityDetailPage
            entityLabel="production.workorder"
            displayId={order.number}
            breadcrumb={[
                { label: "OTs", href: "/production/orders" },
                { label: order.number || "Nueva", href: `/production/orders/${orderId}` },
            ]}
            instanceId={parseInt(orderId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push("/production/orders")}>Volver</CancelButton>
                            <ActionSlideButton
                                onClick={() => {
                                    setTargetStage(undefined)
                                    setWizardOpen(true)
                                }}
                                className="ml-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            >
                                Gestionar Workflow
                            </ActionSlideButton>
                            {isEditable && (
                                <ActionSlideButton
                                    onClick={() => {
                                        setTargetStage('BASIC_INFO')
                                        setWizardOpen(true)
                                    }}
                                >
                                    Editar OT
                                </ActionSlideButton>
                            )}
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Descripción</p>
                        <p className="font-semibold">{order.description}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Etapa Actual</p>
                        <p className="font-semibold">{translateProductionStage(order.current_stage)}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Fecha Inicio</p>
                        <p className="font-semibold">{order.start_date ? formatPlainDate(order.start_date) : '—'}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Fecha Entrega</p>
                        <p className="font-semibold">{order.due_date ? formatPlainDate(order.due_date) : '—'}</p>
                    </div>
                    <div className="space-y-2 col-span-2">
                        <p className="text-sm text-muted-foreground">Cliente / Nota de Venta</p>
                        <p className="font-semibold">
                            {order.sale_order ? `${formatEntityDisplay('sales.saleorder', { number: order.sale_order })} · ` : ''}{order.sale_customer_name || 'Sin cliente asociado'}
                        </p>
                    </div>
                </div>

                {wizardOpen && (
                    <WorkOrderWizard
                        mode={{ kind: 'manage', orderId: parseInt(orderId), targetStage }}
                        open={wizardOpen}
                        onOpenChange={setWizardOpen}
                        onSuccess={() => fetchOrder()}
                    />
                )}
            </div>
        </EntityDetailPage>
    )
}
