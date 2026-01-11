"use client"

import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Building2, Warehouse } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

interface Step0_SupplierProps {
    selectedSupplierId: string
    setSelectedSupplierId: (id: string) => void
    setSelectedSupplierName: (name: string) => void
    selectedWarehouseId: string
    setSelectedWarehouseId: (id: string) => void
}

export function Step0_Supplier({
    selectedSupplierId,
    setSelectedSupplierId,
    setSelectedSupplierName,
    selectedWarehouseId,
    setSelectedWarehouseId
}: Step0_SupplierProps) {
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [suppliersRes, warehousesRes] = await Promise.all([
                    api.get('/contacts/?is_supplier=true'),
                    api.get('/inventory/warehouses/')
                ])

                const suppliersList = suppliersRes.data.results || suppliersRes.data
                setSuppliers(suppliersList)
                setWarehouses(warehousesRes.data.results || warehousesRes.data)

                // Auto-select default supplier if exists and none selected
                if (!selectedSupplierId) {
                    const defaultSupplier = suppliersList.find((s: any) => s.is_default_vendor)
                    if (defaultSupplier) {
                        setSelectedSupplierId(defaultSupplier.id.toString())
                        setSelectedSupplierName(defaultSupplier.name)
                    }
                }

                // Auto-select first warehouse if only one
                const whList = warehousesRes.data.results || warehousesRes.data
                if (whList.length === 1 && !selectedWarehouseId) {
                    setSelectedWarehouseId(whList[0].id.toString())
                }
            } catch (error) {
                console.error("Failed to fetch suppliers/warehouses", error)
            }
        }
        fetchData()
    }, [])

    // Update supplier name when ID changes
    useEffect(() => {
        if (selectedSupplierId) {
            const supplier = suppliers.find(s => s.id.toString() === selectedSupplierId)
            if (supplier) {
                setSelectedSupplierName(supplier.name)
            }
        }
    }, [selectedSupplierId, suppliers])

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Proveedor
                </Label>
                <AdvancedContactSelector
                    value={selectedSupplierId}
                    onChange={(val) => setSelectedSupplierId(val || "")}
                    contactType="SUPPLIER"
                    placeholder="Buscar proveedor..."
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="warehouse" className="text-sm font-semibold flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    Bodega Destino
                </Label>
                <select
                    id="warehouse"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                    <option value="">Seleccionar bodega...</option>
                    {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}
