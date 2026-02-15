"use client"

import { Label } from "@/components/ui/label"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { User, Info } from "lucide-react"

interface Step0_CustomerProps {
    selectedCustomerId: string | null
    setSelectedCustomerId: (id: string | null) => void
    setSelectedCustomerName: (name: string) => void
}

export function Step0_Customer({
    selectedCustomerId,
    setSelectedCustomerId,
    setSelectedCustomerName
}: Step0_CustomerProps) {
    return (
        <div className="space-y-6 flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <User className="h-8 w-8 text-primary" />
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">Seleccionar Cliente</h3>
                <p className="text-sm text-muted-foreground">
                    Busque un cliente por nombre o RUT para asociar a esta venta.
                </p>
            </div>

            <div className="w-full space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Cliente</Label>
                    <AdvancedContactSelector
                        value={selectedCustomerId}
                        onChange={setSelectedCustomerId}
                        onSelectContact={(contact) => setSelectedCustomerName(contact.name)}
                        placeholder="Buscar por Nombre, RUT o Email..."
                    />
                </div>
            </div>
        </div>
    )
}
