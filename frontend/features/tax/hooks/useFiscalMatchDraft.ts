'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { FiscalMatchChange, FiscalMatchDetail, FiscalMatchPart, FiscalMatchSearchItem } from '../types/fiscalMatch'
import {
    applyError,
    applyPayment,
    applyRemove,
    applySelect,
    applyUnselect,
    consequencesOf,
    hasMissingPayment,
    reconcileEntries,
    stateOf as stateOfEntries,
    toBody,
    type DraftCardState,
    type DraftEntry,
    type SelectResult,
    type VisibleIds,
} from './fiscalMatchDraft'

type Action =
    | { type: 'select'; group: FiscalMatchDetail; part: FiscalMatchPart; item: FiscalMatchSearchItem; movement?: number | null }
    | { type: 'unselect'; part: FiscalMatchPart; id: number }
    | { type: 'remove'; group: FiscalMatchDetail; part: FiscalMatchPart; id: number }
    | { type: 'payment'; saleId: number; movementId: number }
    | { type: 'error'; index: number; message: string }
    | { type: 'replace'; entries: DraftEntry[] }
    | { type: 'discard' }

function reducer(entries: DraftEntry[], action: Action): DraftEntry[] {
    switch (action.type) {
        case 'select': return applySelect(entries, action.group, action.part, action.item, action.movement).entries
        case 'unselect': return applyUnselect(entries, action.part, action.id)
        case 'remove': return applyRemove(entries, action.group, action.part, action.id)
        case 'payment': return applyPayment(entries, action.saleId, action.movementId)
        case 'error': return applyError(entries, action.index, action.message)
        case 'replace': return action.entries
        case 'discard': return []
    }
}

/**
 * Cambios en espera de la ficha de cuadre (solo estado; sin React Query). Un candidato con aviso
 * bloqueante no se puede seleccionar: `select` no cambia nada y devuelve el motivo.
 */
export function useFiscalMatchDraft(group: FiscalMatchDetail | undefined) {
    const [entries, dispatch] = useReducer(reducer, [])
    const latest = useRef(entries)
    useEffect(() => { latest.current = entries }, [entries])

    const select = useCallback((part: FiscalMatchPart, item: FiscalMatchSearchItem, movement?: number | null): SelectResult => {
        if (!group) return { ok: false, reason: 'El grupo aún no está cargado.' }
        const { result } = applySelect(latest.current, group, part, item, movement)
        if (result.ok) dispatch({ type: 'select', group, part, item, movement })
        return result
    }, [group])
    const unselect = useCallback((part: FiscalMatchPart, id: number) => dispatch({ type: 'unselect', part, id }), [])
    const remove = useCallback((part: FiscalMatchPart, id: number) => {
        if (group) dispatch({ type: 'remove', group, part, id })
    }, [group])
    const setPayment = useCallback((saleId: number, movementId: number) => dispatch({ type: 'payment', saleId, movementId }), [])
    const discard = useCallback(() => dispatch({ type: 'discard' }), [])
    const markError = useCallback((index: number, message: string) => dispatch({ type: 'error', index, message }), [])
    const reconcile = useCallback((fresh: FiscalMatchDetail, visible: VisibleIds): string[] => {
        const { entries: kept, notices } = reconcileEntries(latest.current, fresh, visible)
        if (notices.length > 0) dispatch({ type: 'replace', entries: kept })
        return notices
    }, [])

    const stateOf = useCallback((part: FiscalMatchPart, id: number): DraftCardState => stateOfEntries(entries, group, part, id), [entries, group])
    const paymentOf = useCallback((saleId: number): number | null => {
        for (const { change } of entries) {
            if (change.part === 'tuu' && change.id === saleId) return change.movement ?? null
            if (change.part === 'erp') return change.payments?.[saleId] ?? null
        }
        return null
    }, [entries])

    const pending: FiscalMatchChange[] = useMemo(() => toBody(entries), [entries])
    const consequences = useMemo(() => consequencesOf(entries, group), [entries, group])
    const needsPayment = useMemo(() => hasMissingPayment(entries, group), [entries, group])

    return {
        pending, isDirty: entries.length > 0, needsPayment, consequences,
        select, unselect, remove, setPayment, discard, stateOf, paymentOf, markError, reconcile,
    }
}
