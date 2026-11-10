import { useContext, useSyncExternalStore } from 'react'
import { OperatorGateContext, type OperatorGateContextValue } from './operatorGateContext'
import { operatorStore, type ActiveOperatorPass } from './operatorStore'

export interface UseOperatorGateResult extends OperatorGateContextValue {
    activePass: ActiveOperatorPass | null
}

/** Punto único para pedir operador desde borradores, movimientos, cierre y documentos. */
export function useOperatorGate(): UseOperatorGateResult {
    const gate = useContext(OperatorGateContext)
    const activePass = useSyncExternalStore(
        operatorStore.subscribe,
        () => operatorStore.getState().pass,
        () => null,
    )
    return { ...gate, activePass }
}
