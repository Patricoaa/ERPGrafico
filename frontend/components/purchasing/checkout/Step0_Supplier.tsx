"use client"

import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Building2, User } from "lucide-react"

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
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [suppliersRes, warehousesRes] = await Promise.all([
                    api.get('/contacts/?is_supplier=true'),
                    api.get('/inventory/warehouses/')
                ])
                setSuppliers(suppliersRes.data.results || suppliersRes.data)
                setWarehouses(warehousesRes.data.results || warehousesRes.data)

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

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tax_id?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const selectedSupplier = suppliers.find(s => s.id.toString() === selectedSupplierId)

    return (
        <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
                    <Building2 className="inline h-4 w-4 mr-1" />
                    Proveedor
                </Label>
                <input
                    type="text"
                    placeholder="Buscar proveedor..."
                    className="w-full px-3 py-2 rounded-md border bg-background mb-3"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredSuppliers.map((supplier) => (
                        <div
                            key={supplier.id}
                            onClick={() => {
                                setSelectedSupplierId(supplier.id.toString())
                                setSelectedSupplierName(supplier.name)
                            }}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedSupplierId === supplier.id.toString()
                                    ? 'border-primary bg-primary/10'
                                    : 'border-muted hover:border-primary/50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">{supplier.name}</p>
                                    {supplier.tax_id && (
                                        <p className="text-xs text-muted-foreground">RUT: {supplier.tax_id}</p>
                                    )}
                                </div>
                                {selectedSupplierId === supplier.id.toString() && (
                                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                        <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="warehouse" className="text-xs font-bold uppercase">
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
