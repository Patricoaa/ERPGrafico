"use client"

import { User, Users } from "lucide-react"
import { ChoiceCard, ChoiceGroup } from "@/components/shared"
import type { POSSessionMode } from "@/types/pos"

interface CashModeChoiceProps {
    value: POSSessionMode
    onChange: (mode: POSSessionMode) => void
}

/**
 * Modo de caja al abrir una sesión de POS. Queda fijo hasta cerrarla.
 * SINGLE no cambia nada respecto a hoy; MULTI pide elegir al operador en cada transacción.
 */
export function CashModeChoice({ value, onChange }: CashModeChoiceProps) {
    return (
        <ChoiceGroup label="Modo de caja" columns="grid-cols-1 sm:grid-cols-2">
            <ChoiceCard
                variant="light"
                icon={User}
                title="Un solo usuario"
                description="Opera quien inició sesión, sin pasos adicionales."
                selected={value === "SINGLE"}
                onSelect={() => onChange("SINGLE")}
            />
            <ChoiceCard
                variant="light"
                icon={Users}
                title="Multiusuario"
                description="Pide elegir al operador en cada transacción."
                selected={value === "MULTI"}
                onSelect={() => onChange("MULTI")}
            />
        </ChoiceGroup>
    )
}
