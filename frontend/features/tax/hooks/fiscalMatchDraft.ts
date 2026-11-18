import type {
    FiscalMatchChange,
    FiscalMatchDetail,
    FiscalMatchPart,
    FiscalMatchSearchItem,
} from '../types/fiscalMatch'

/**
 * Borrador de cambios de la ficha de cuadre (spec §5.1, §5.4, §7b). Lógica pura: el hook
 * `useFiscalMatchDraft` solo la envuelve en un `useReducer`.
 */

export type DraftCardState = 'linked' | 'toRemove' | 'selected' | 'error' | 'idle'

export interface DraftEntry {
    change: FiscalMatchChange
    /** Tarjeta elegida (solo en `link`); da la etiqueta de los avisos y las opciones de pago. */
    item?: FiscalMatchSearchItem
    error?: string
}

export type SelectResult = { ok: true } | { ok: false; reason: string }

/** Ids disponibles por parte tras un refresco (candidatos visibles); una parte ausente no se valida. */
export type VisibleIds = Partial<Record<FiscalMatchPart, Iterable<number>>>

const BOLETA_TYPES = [39, 41]
const PART_NAME: Record<FiscalMatchPart, string> = { erp: 'el documento', tuu: 'la venta TUU', rcv: 'el registro del SII' }

export const isOrphan = (group: FiscalMatchDetail): boolean => group.invoice === null

/** ERP: uno (y solo en huérfanos); TUU: varios; RCV: varios en boletas, uno en facturas y notas. */
export function maxSelection(group: FiscalMatchDetail, part: FiscalMatchPart): number {
    if (part === 'erp') return isOrphan(group) ? 1 : 0
    if (part === 'tuu') return Infinity
    return group.dte_type !== null && BOLETA_TYPES.includes(group.dte_type) ? Infinity : 1
}

export function linkedIds(group: FiscalMatchDetail, part: FiscalMatchPart): number[] {
    if (part === 'erp') return group.invoice ? [group.invoice.id] : []
    return (part === 'tuu' ? group.terminal_sales : group.rcv_documents).map(r => r.id)
}

const same = (e: DraftEntry, part: FiscalMatchPart, id: number): boolean =>
    e.change.part === part && e.change.id === id

/** Pagos de las ventas propias del huérfano para el documento elegido; se asigna solo si hay una opción. */
function ownPayments(group: FiscalMatchDetail, item: FiscalMatchSearchItem): Record<number, number> | null {
    const out: Record<number, number> = {}
    for (const sale of group.terminal_sales) {
        const options = item.payments_by_sale?.[String(sale.id)] ?? []
        if (options.length === 1) out[sale.id] = options[0].id
    }
    return Object.keys(out).length > 0 ? out : null
}

export function applySelect(
    entries: DraftEntry[],
    group: FiscalMatchDetail,
    part: FiscalMatchPart,
    item: FiscalMatchSearchItem,
    movement?: number | null,
): { entries: DraftEntry[]; result: SelectResult } {
    const blocking = item.warnings.find(w => w.blocking)
    if (blocking) return { entries, result: { ok: false, reason: blocking.label } }
    if (part === 'erp' && !isOrphan(group)) {
        return { entries, result: { ok: false, reason: 'Solo un grupo sin documento puede elegir uno.' } }
    }
    if (linkedIds(group, part).includes(item.id)) {
        // Ya unido: si estaba por quitar, seleccionarlo cancela la salida.
        const rest = entries.filter(e => !(same(e, part, item.id) && e.change.op === 'unlink'))
        return { entries: rest, result: { ok: true } }
    }
    let next = entries.filter(e => !(same(e, part, item.id) && e.change.op === 'link'))
    const max = maxSelection(group, part)
    if (max === 1) next = next.filter(e => !(e.change.part === part && e.change.op === 'link'))

    const change: FiscalMatchChange = { op: 'link', part, id: item.id }
    if (part === 'tuu') {
        const only = item.compatible_movements?.length === 1 ? item.compatible_movements[0].id : null
        change.movement = movement ?? only
    } else if (part === 'erp') {
        change.payments = ownPayments(group, item)
    }
    return { entries: [...next, { change, item }], result: { ok: true } }
}

export function applyUnselect(entries: DraftEntry[], part: FiscalMatchPart, id: number): DraftEntry[] {
    return entries.filter(e => !same(e, part, id))
}

/** Quita un registro ya unido (queda en espera). El documento ERP no se puede quitar. */
export function applyRemove(
    entries: DraftEntry[],
    group: FiscalMatchDetail,
    part: FiscalMatchPart,
    id: number,
): DraftEntry[] {
    if (part === 'erp' || !linkedIds(group, part).includes(id)) return entries
    if (entries.some(e => same(e, part, id) && e.change.op === 'unlink')) return entries
    return [...entries, { change: { op: 'unlink', part, id } }]
}

/** Pago de una venta TUU: de su propio cambio, o de las ventas propias del huérfano en el cambio ERP. */
export function applyPayment(entries: DraftEntry[], saleId: number, movementId: number): DraftEntry[] {
    return entries.map(e => {
        if (e.change.op !== 'link') return e
        if (e.change.part === 'tuu' && e.change.id === saleId) {
            return { ...e, error: undefined, change: { ...e.change, movement: movementId } }
        }
        if (e.change.part === 'erp') {
            return { ...e, error: undefined, change: { ...e.change, payments: { ...e.change.payments, [saleId]: movementId } } }
        }
        return e
    })
}

export function applyError(entries: DraftEntry[], index: number, message: string): DraftEntry[] {
    return entries.map((e, i) => (i === index ? { ...e, error: message } : e))
}

export function stateOf(entries: DraftEntry[], group: FiscalMatchDetail | undefined, part: FiscalMatchPart, id: number): DraftCardState {
    const entry = entries.find(e => same(e, part, id))
    if (entry?.error) return 'error'
    if (entry) return entry.change.op === 'unlink' ? 'toRemove' : 'selected'
    if (part === 'rcv' && carriedRcv(entries).some(d => d.id === id)) return 'linked'
    return group && linkedIds(group, part).includes(id) ? 'linked' : 'idle'
}

/** Registros del SII que viajan con las ventas TUU seleccionadas. */
function carriedRcv(entries: DraftEntry[]): { id: number; folio: string }[] {
    return entries.flatMap(e => (e.change.op === 'link' && e.change.part === 'tuu' ? (e.item?.carried_rcv ?? []) : []))
}

/** Cambios que viajan a `apply` (sin la tarjeta ni el error). */
export const toBody = (entries: DraftEntry[]): FiscalMatchChange[] => entries.map(e => e.change)

/** Falta elegir algún pago: no se puede guardar todavía. */
export function hasMissingPayment(entries: DraftEntry[], group: FiscalMatchDetail | undefined): boolean {
    return entries.some(e => {
        if (e.change.op !== 'link') return false
        if (e.change.part === 'tuu') return e.change.movement == null
        if (e.change.part !== 'erp' || !group) return false
        return group.terminal_sales.some(s => {
            const options = e.item?.payments_by_sale?.[String(s.id)] ?? []
            return options.length > 0 && e.change.payments?.[s.id] == null
        })
    })
}

/** «Se moverá también»: al elegir un documento, los registros propios del huérfano viajan con él. */
export function consequencesOf(entries: DraftEntry[], group: FiscalMatchDetail | undefined): string[] {
    const carried = carriedRcv(entries).map(r => `La boleta SII folio ${r.folio} se moverá también`)
    if (!group || !entries.some(e => e.change.part === 'erp' && e.change.op === 'link')) return carried
    const rcv = group.rcv_documents.map(r => `La boleta SII folio ${r.folio} se moverá también`)
    const tuu = group.terminal_sales.map(s => `La venta TUU #${s.id} se moverá también`)
    return [...tuu, ...rcv, ...carried]
}

/**
 * Descarta los cambios cuyo registro ya no está disponible tras un refresco (cuadrado en otro
 * grupo, grupo que dejó de ser huérfano, registro que ya no está unido) y devuelve los avisos.
 */
export function reconcileEntries(
    entries: DraftEntry[],
    group: FiscalMatchDetail,
    visible: VisibleIds,
): { entries: DraftEntry[]; notices: string[] } {
    const sets = new Map<FiscalMatchPart, Set<number>>()
    for (const [part, ids] of Object.entries(visible) as [FiscalMatchPart, Iterable<number>][]) sets.set(part, new Set(ids))
    const notices: string[] = []
    const kept = entries.filter(e => {
        const { op, part, id } = e.change
        const gone =
            op === 'unlink'
                ? !linkedIds(group, part).includes(id)
                : (part === 'erp' && !isOrphan(group)) || (sets.has(part) && !sets.get(part)?.has(id))
        if (gone) {
            const label = e.item?.label ?? `#${id}`
            const why = op === 'unlink' ? 'ya no está unido a este grupo' : 'se cuadró en otro grupo'
            notices.push(`1 cambio ya no aplica: ${PART_NAME[part]} ${label} ${why}`)
        }
        return !gone
    })
    return { entries: kept, notices }
}
