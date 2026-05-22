"use client"

import { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, SkeletonShell } from "@/components/shared"
import { WarehouseForm } from "./WarehouseForm"
import { useWarehouse, type Warehouse } from "../hooks/useWarehouses"

interface WarehouseDetailClientProps {
    warehouseId: string
}

// Placeholder tipado para el esqueleto — sigue el contrato.
const WAREHOUSE_SKELETON: Warehouse = {
    id: 0,
    name: "————————————",
    code: "————————————",
    address: "",
}

export function WarehouseDetailClient({ warehouseId }: WarehouseDetailClientProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const numericId = Number(warehouseId)
    const idIsValid = Number.isFinite(numericId) && numericId > 0

    const { data: warehouse, isLoading: loading, error: queryError } = useWarehouse(idIsValid ? numericId : null)
    const error = queryError ? (queryError as { response?: { status?: number } })?.response?.status ?? 500 : null

    if (!idIsValid || error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la bodega</div>

    return (
        <SkeletonShell isLoading={loading || !warehouse} ariaLabel="Cargando detalle de bodega">
            <EntityDetailPage
                entityLabel="inventory.warehouse"
                displayId={(warehouse ?? WAREHOUSE_SKELETON).code ?? "————————————"}
                breadcrumb={[
                    { label: "Bodegas", href: "/inventory/settings?tab=warehouses" },
                    { label: (warehouse ?? WAREHOUSE_SKELETON).name, href: `/inventory/warehouses/${warehouseId}` }
                ]}
                instanceId={(warehouse ?? WAREHOUSE_SKELETON).id ?? 0}
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
                        }}
                    />
                </div>
            </EntityDetailPage>
        </SkeletonShell>
    )
}
