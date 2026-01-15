"use client"

import { useState, useEffect } from "react"
import { Building2, User } from "lucide-react"
import api from "@/lib/api"

export interface Step0_SupplierProps {
    selectedSupplierId: string
    setSelectedSupplierId: (id: string) => void
    setSelectedSupplierName: (name: string) => void
}

export function Step0_Supplier({
    selectedSupplierId,
    setSelectedSupplierId,
    setSelectedSupplierName
}: Step0_SupplierProps) {
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const response = await api.get('/contacts/suppliers/')
                const suppliersList = response.data.results || response.data
                setSuppliers(suppliersList)

                // Auto-select default supplier if exists and none selected
                if (!selectedSupplierId) {
                    const defaultSupplier = suppliersList.find((s: any) => s.is_default)
                    if (defaultSupplier) {
                        setSelectedSupplierId(defaultSupplier.id.toString())
                        setSelectedSupplierName(defaultSupplier.name)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch suppliers", error)
            } finally {
                setLoading(false)
            }
        }
        fetchSuppliers()
    }, [selectedSupplierId, setSelectedSupplierId, setSelectedSupplierName])

    const handleSupplierChange = (val: string) => {
        setSelectedSupplierId(val)
        const supplier = suppliers.find(s => s.id.toString() === val)
        if (supplier) {
            setSelectedSupplierName(supplier.name)
        } else {
            setSelectedSupplierName("")
        }
    }

    return (
        <div className="flex flex-col items-center justify-center space-y-8 py-12 max-w-2xl mx-auto text-center">
            <div className="relative">
                <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-background p-6 rounded-2xl shadow-xl border-2 border-primary/20">
                    <Building2 className="h-16 w-16 text-primary" />
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Seleccionar Proveedor</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Busque un proveedor por nombre o RUT para asociar a esta compra.
                </p>
            </div>

            <div className="w-full space-y-4">
                <div className="relative group text-left">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none px-3">
                        <User className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <select
                        id="supplier"
                        className="flex h-14 w-full rounded-xl border-2 border-input bg-background/50 pl-12 pr-4 py-2 text-lg font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-background/80 appearance-none"
                        value={selectedSupplierId}
                        onChange={(e) => handleSupplierChange(e.target.value)}
                        disabled={loading}
                    >
                        <option value="">{loading ? "Cargando proveedores..." : "Seleccionar un proveedor..."}</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={s.id.toString()}>{s.name} ({s.tax_id})</option>
                        ))}
                    </select>
                </div>

                {!selectedSupplierId && !loading && (
                    <p className="text-sm text-amber-600 font-medium animate-in fade-in slide-in-from-top-2">
                        Debe seleccionar un proveedor para proceder con la selección de productos.
                    </p>
                )}
            </div>
        </div>
    )
}
