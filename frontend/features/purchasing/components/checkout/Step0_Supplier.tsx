"use client"

import { useState, useEffect } from "react"
import { Building2, AlertCircle } from "lucide-react"
import { StepHeader, ContactCardGrid } from "@/components/shared"
import { AdvancedWorkOrderSelector } from "@/components/selectors/AdvancedWorkOrderSelector"
import { purchasingApi } from "../../api/purchasingApi"

export interface Step0_SupplierProps {
    selectedSupplierId: string | null
    setSelectedSupplierId: (id: string | null) => void
    setSelectedSupplierName: (name: string) => void
    selectedWorkOrderId: string | null
    setSelectedWorkOrderId: (id: string | null) => void
}

export function Step0_Supplier({
    selectedSupplierId,
    setSelectedSupplierId,
    setSelectedSupplierName,
    selectedWorkOrderId,
    setSelectedWorkOrderId
}: Step0_SupplierProps) {
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchDefaultSupplier = async () => {
            if (!selectedSupplierId) {
                setLoading(true)
                try {
                    // Fetch contacts filtered by default vendor flag
                    const suppliers = await purchasingApi.getDefaultSupplier()
                    if (suppliers && suppliers.length > 0) {
                        const defaultSupplier = suppliers[0] as { id: number; name: string }
                        setSelectedSupplierId(defaultSupplier.id.toString())
                        setSelectedSupplierName(defaultSupplier.name)
                    }
                } catch (error) {
                    console.error("Failed to fetch default supplier", error)
                } finally {
                    setLoading(false)
                }
            }
        }
        fetchDefaultSupplier()
    }, [selectedSupplierId, setSelectedSupplierId, setSelectedSupplierName])

    return (
        <div className="space-y-6">
            <StepHeader title="Seleccionar Proveedor" description="Busque un proveedor por nombre o RUT para asociar a esta compra." icon={Building2} />

            <div className="w-full space-y-6">
                <ContactCardGrid
                    selectedId={selectedSupplierId}
                    onSelect={(contact) => {
                        setSelectedSupplierId(contact.id.toString())
                        setSelectedSupplierName(contact.name)
                    }}
                    contactType="SUPPLIER"
                    placeholder="Buscar por Nombre, RUT o Email..."
                />

                <div className="space-y-1">
                    <AdvancedWorkOrderSelector
                        label="Orden de Trabajo (Opcional)"
                        value={selectedWorkOrderId}
                        onChange={setSelectedWorkOrderId}
                    />
                    <p className="text-[10px] text-muted-foreground italic px-1">
                        Seleccione una OT si desea vincular esta compra manualmente a un trabajo de producción.
                    </p>
                </div>

                {!selectedSupplierId && !loading && (
                    <div className="flex items-center gap-2 text-sm text-warning font-medium py-2 px-3 bg-warning/10 rounded-md border border-warning/10 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4" />
                        Debe seleccionar un proveedor para proceder.
                    </div>
                )}
            </div>
        </div>
    )
}
