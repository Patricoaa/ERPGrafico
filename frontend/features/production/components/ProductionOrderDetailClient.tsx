"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import api from "@/lib/api"
import type { WorkOrder } from "@/features/production/types"
import { toast } from "sonner"
import { WorkOrderForm } from "@/features/production/components/forms/WorkOrderForm"
import { WorkOrderWizard } from "@/features/production/components/WorkOrderWizard"
import { translateProductionStage } from "@/lib/utils"

interface ProductionOrderDetailClientProps {
    orderId: string
}

export function ProductionOrderDetailClient({ orderId }: ProductionOrderDetailClientProps) {
    const router = useRouter()
    const [order, setOrder] = useState<WorkOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [wizardOpen, setWizardOpen] = useState(false)

    const fetchOrder = async () => {
        try {
            const response = await api.get(`/production/orders/${orderId}/`)
            setOrder(response.data)
        } catch (err: any) {
            setError(err.response?.status || 500)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOrder()
    }, [orderId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar OT
        </div>
    )

    if (loading || !order) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const isEditable = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order.current_stage)

    return (
        <EntityDetailPage
            entityType="production_order"
            title="Orden de Trabajo"
            displayId={order.number}
            icon="factory"
            breadcrumb={[
                { label: "OTs", href: "/production/orders" },
                { label: order.number, href: `/production/orders/${orderId}` },
            ]}
            instanceId={parseInt(orderId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push("/production/orders")}>Volver</CancelButton>
                            <ActionSlideButton onClick={() => setWizardOpen(true)} className="ml-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                Gestionar Workflow
                            </ActionSlideButton>
                            {isEditable && (
                                <ActionSlideButton onClick={() => setFormOpen(true)}>
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
                        <p className="font-semibold">{order.start_date ? new Date(order.start_date).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Fecha Entrega</p>
                        <p className="font-semibold">{order.due_date ? new Date(order.due_date).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="space-y-2 col-span-2">
                        <p className="text-sm text-muted-foreground">Cliente / Nota de Venta</p>
                        <p className="font-semibold">
                            {order.sale_order ? `NV-${order.sale_order} · ` : ''}{order.sale_customer_name || 'Sin cliente asociado'}
                        </p>
                    </div>
                </div>

                {formOpen && (
                    <WorkOrderForm
                        initialData={order as any}
                        open={formOpen}
                        onOpenChange={setFormOpen}
                        onSuccess={() => {
                            fetchOrder()
                            setFormOpen(false)
                        }}
                    />
                )}

                {wizardOpen && (
                    <WorkOrderWizard
                        orderId={parseInt(orderId)}
                        open={wizardOpen}
                        onOpenChange={setWizardOpen}
                        onSuccess={fetchOrder}
                    />
                )}
            </div>
        </EntityDetailPage>
    )
}
