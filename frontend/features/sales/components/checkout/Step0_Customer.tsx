"use client"

import { User, Info } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { LabeledContainer } from "@/components/shared/LabeledContainer"

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
            <User className="h-8 w-8 text-muted-foreground" />

            <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">Seleccionar Cliente</h3>
                <p className="text-sm text-muted-foreground">
                    Busque un cliente por nombre o RUT para asociar a esta venta.
                </p>
            </div>

            <div className="w-full max-w-md">
                <AdvancedContactSelector
                    label="Buscar Cliente"
                    icon={<User className="h-4 w-4" />}
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    onSelectContact={(contact) => setSelectedCustomerName(contact.name)}
                    placeholder="Nombre, RUT o Email..."
                    className="h-9"
                />
            </div>
        </div>
    )
}
