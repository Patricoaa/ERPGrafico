"use client"

import { UserRound } from "lucide-react"
import { Chip } from "@/components/shared"
import { useOperatorGate } from "./useOperatorGate"

/** Muestra quién es el operador activo; no se renderiza en cajas de un solo usuario. */
export function OperatorChip() {
    const { isMultiUser, activePass } = useOperatorGate()
    if (!isMultiUser || !activePass) return null
    return (
        <Chip size="xs" intent="neutral" icon={UserRound}>
            Operador: {activePass.operator.full_name}
        </Chip>
    )
}
