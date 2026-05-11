"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { WarehouseForm } from "./WarehouseForm"

interface WarehouseDetailClientProps {
    warehouseId: string
}

export function WarehouseDetailClient({ warehouseId }: WarehouseDetailClientProps) {
    const [warehouse, setWarehouse] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        api.get(`/inventory/warehouses/${warehouseId}/`)
            .then(res => setWarehouse(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [warehouseId])

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la bodega</div>
    
    if (loading || !warehouse) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    return (
        <EntityDetailPage
            entityLabel="inventory.warehouse"
            displayId={warehouse.code}
            breadcrumb={[
                { label: "Bodegas", href: "/inventory/settings?tab=warehouses" },
                { label: warehouse.name, href: `/inventory/warehouses/${warehouseId}` }
            ]}
            instanceId={warehouse.id}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/inventory/settings?tab=warehouses')} disabled={isSaving} />
                            <SubmitButton form="warehouse-form" loading={isSaving}>
                                Guardar Cambios
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto h-full">
                <WarehouseForm 
                    open={true}
                    inline={true}
                    onOpenChange={(open) => {
                        if (!open) router.push('/inventory/settings?tab=warehouses')
                    }}
                    initialData={warehouse} 
                    onLoadingChange={setIsSaving}
                    onSuccess={() => {
                        router.push('/inventory/settings?tab=warehouses')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
