"use client"

import { User, Users } from "lucide-react"
import { ChoiceCard, ChoiceGroup } from "@/components/shared"
import type { POSSessionMode } from "@/types/pos"

interface CashModeChoiceProps {
    value: POSSessionMode
    onChange: (mode: POSSessionMode) => void
    /** `touch` renders large stacked cards for full-screen touch flows (POS opening). Default: compact rows. */
    size?: "default" | "touch"
}

const OPTIONS: { mode: POSSessionMode; icon: typeof User; title: string; description: string }[] = [
    { mode: "SINGLE", icon: User, title: "Un solo usuario", description: "Opera quien inició sesión, sin pasos adicionales." },
    { mode: "MULTI", icon: Users, title: "Multiusuario", description: "Pide elegir al operador en cada transacción." },
]

/**
 * Modo de caja al abrir una sesión de POS. Queda fijo hasta cerrarla.
 * SINGLE no cambia nada respecto a hoy; MULTI pide elegir al operador en cada transacción.
 */
export function CashModeChoice({ value, onChange, size = "default" }: CashModeChoiceProps) {
    const touch = size === "touch"
    return (
        <ChoiceGroup
            label="Modo de caja"
            columns="grid-cols-1 sm:grid-cols-2"
            // En táctil elegir avanza el flujo: las flechas solo mueven el foco
            activation={touch ? "focus" : "select"}
            className={touch ? "gap-4" : undefined}
        >
            {OPTIONS.map(opt => touch ? (
                <ChoiceCard
                    key={opt.mode}
                    size="touch"
                    icon={opt.icon}
                    title={opt.title}
                    description={opt.description}
                    selected={value === opt.mode}
                    onSelect={() => onChange(opt.mode)}
                />
            ) : (
                <ChoiceCard
                    key={opt.mode}
                    variant="light"
                    icon={opt.icon}
                    title={opt.title}
                    description={opt.description}
                    selected={value === opt.mode}
                    onSelect={() => onChange(opt.mode)}
                />
            ))}
        </ChoiceGroup>
    )
}
