"use client"

import { useState, useEffect } from "react"
import { Building2, User, AlertCircle, Package } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { AdvancedWorkOrderSelector } from "@/components/selectors/AdvancedWorkOrderSelector"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"

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
                    const response = await api.get('/contacts/?is_default_vendor=true')
                    const results = response.data.results || response.data
                    if (results && results.length > 0) {
                        const defaultSupplier = results[0]
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
        <div className="space-y-8 flex flex-col items-center justify-center min-h-[400px] max-w-2xl mx-auto">
            <div className="relative">
                <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-background p-6 rounded-lg shadow-xl border-2 border-primary/20">
                    <Building2 className="h-12 w-12 text-primary" />
                </div>
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Seleccionar Proveedor</h3>
                <p className="text-muted-foreground">
                    Busque un proveedor por nombre o RUT para asociar a esta compra.
                </p>
            </div>

            <div className="w-full space-y-6">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                        Proveedor
                    </Label>
                    <AdvancedContactSelector
                        value={selectedSupplierId}
                        onChange={setSelectedSupplierId}
                        onSelectContact={(contact) => setSelectedSupplierName(contact.name)}
                        contactType="SUPPLIER"
                        placeholder="Buscar por Nombre, RUT o Email..."
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                        <Package className="h-3 w-3" /> Orden de Trabajo (Opcional)
                    </Label>
                    <AdvancedWorkOrderSelector
                        value={selectedWorkOrderId}
                        onChange={setSelectedWorkOrderId}
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                        Seleccione una OT si desea vincular esta compra manualmente a un trabajo de producción.
                    </p>
                </div>

                {!selectedSupplierId && !loading && (
                    <div className="flex items-center gap-2 text-sm text-warning font-medium py-2 px-3 bg-warning/10 rounded-lg border border-warning/10 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4" />
                        Debe seleccionar un proveedor para proceder.
                    </div>
                )}
            </div>
        </div>
    )
}
