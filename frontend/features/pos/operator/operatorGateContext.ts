"use client"

import { createContext } from 'react'
import type { OperatorPurpose } from '@/lib/pos-operator'
import type { OperatorTarget } from './operatorStore'

export interface OperatorGateContextValue {
    /** La sesión actual es multiusuario. */
    isMultiUser: boolean
    /**
     * Garantiza que haya un operador identificado para la acción. En SINGLE resuelve `true`
     * sin interfaz; en MULTI reutiliza el pase vigente (mismo propósito y destino) o abre
     * el selector. Resuelve `false` si el usuario cancela.
     */
    ensureOperator: (purpose: OperatorPurpose, target?: OperatorTarget) => Promise<boolean>
    /** Termina el pase vigente (avisa al backend) y limpia los encabezados. */
    release: (purpose?: OperatorPurpose) => Promise<void>
    /** Olvida el pase localmente sin avisar al backend (ya lo consumió: cobro, movimiento, cierre). */
    forget: () => void
    /** Liga el pase vigente al borrador recién creado. */
    bindTarget: (id: number) => void
    /** Destino a usar si el backend pide operador para este propósito sin que la request lo revele. */
    setChallengeTarget: (purpose: OperatorPurpose, target: OperatorTarget | null) => void
}

/** Valor sin provider (p. ej. un componente compartido fuera del POS): no se exige nada. */
export const NOOP_GATE: OperatorGateContextValue = {
    isMultiUser: false,
    ensureOperator: async () => true,
    release: async () => undefined,
    forget: () => undefined,
    bindTarget: () => undefined,
    setChallengeTarget: () => undefined,
}

export const OperatorGateContext = createContext<OperatorGateContextValue>(NOOP_GATE)
