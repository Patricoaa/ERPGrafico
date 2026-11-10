/**
 * Estado del pase de operador activo de esta pestaña (spec 2026-11-10).
 *
 * Es un store externo (no estado de React) porque el interceptor de Axios y los hooks
 * del POS lo leen fuera del árbol de componentes. Mantener el pase aquí es lo único que
 * escribe el encabezado `X-POS-Operator-Pass` de `lib/pos-operator`.
 */
import { setPosOperatorHeaders, type OperatorPurpose } from '@/lib/pos-operator'

export interface OperatorTarget {
    /** Etiqueta del modelo, p. ej. `sales.draftcart`. */
    type: string
    id: number
}

export interface ActiveOperatorPass {
    token: string
    operator: { id: number; full_name: string; username: string }
    purpose: OperatorPurpose
    /** Id del borrador / documento al que quedó ligado el pase; `null` si aún no tiene. */
    targetId: number | null
}

interface OperatorStoreState {
    pass: ActiveOperatorPass | null
    /** Destino a usar cuando el backend pide operador y la request no lo revela (documento abierto). */
    challengeTargets: Partial<Record<OperatorPurpose, OperatorTarget>>
}

const initial = (): OperatorStoreState => ({ pass: null, challengeTargets: {} })

let state: OperatorStoreState = initial()
const listeners = new Set<() => void>()

function emit(next: OperatorStoreState) {
    state = next
    listeners.forEach((l) => l())
}

export const operatorStore = {
    getState: (): OperatorStoreState => state,
    subscribe: (listener: () => void): (() => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
    },
    setPass(pass: ActiveOperatorPass | null): void {
        setPosOperatorHeaders({ pass: pass?.token })
        emit({ ...state, pass })
    },
    bindTarget(id: number): void {
        if (state.pass) emit({ ...state, pass: { ...state.pass, targetId: id } })
    },
    setChallengeTarget(purpose: OperatorPurpose, target: OperatorTarget | null): void {
        const challengeTargets = { ...state.challengeTargets }
        if (target) challengeTargets[purpose] = target
        else delete challengeTargets[purpose]
        emit({ ...state, challengeTargets })
    },
    /** Descarta pase y destinos (cambio de sesión, cierre, pruebas). */
    reset(): void {
        setPosOperatorHeaders({ pass: undefined })
        emit(initial())
    },
}
