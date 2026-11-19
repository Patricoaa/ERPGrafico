import type {
    CandidateMovement,
    FiscalMatchChange,
    FiscalMatchDetail,
    FiscalMatchPart,
    FiscalMatchSearchItem,
    FiscalMatchWarning,
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

/** Registros con «Quitar» en espera en una parte. */
function removedIds(entries: DraftEntry[], part: FiscalMatchPart): Set<number> {
    return new Set(entries.filter(e => e.change.op === 'unlink' && e.change.part === part).map(e => e.change.id))
}

/** Pagos ya elegidos por otras ventas del borrador (un pago respalda una sola venta). */
export function takenPayments(entries: DraftEntry[], exceptSaleId?: number): Set<number> {
    const out = new Set<number>()
    for (const { change } of entries) {
        if (change.op !== 'link') continue
        if (change.part === 'tuu' && change.id !== exceptSaleId && change.movement != null) out.add(change.movement)
        if (change.part === 'erp') {
            for (const [saleId, m] of Object.entries(change.payments ?? {})) if (Number(saleId) !== exceptSaleId) out.add(m)
        }
    }
    return out
}

/** El pago se asigna solo si hay exactamente uno del mismo monto (y nadie más lo eligió). */
function autoPayment(options: CandidateMovement[] | undefined, taken: Set<number>): number | null {
    const same = (options ?? []).filter(m => m.same_amount)
    return same.length === 1 && !taken.has(same[0].id) ? same[0].id : null
}

/** Pagos de las ventas propias del huérfano (salvo las que se quitan) para el documento elegido. */
function ownPayments(entries: DraftEntry[], group: FiscalMatchDetail, item: FiscalMatchSearchItem): Record<number, number> | null {
    const out: Record<number, number> = {}
    const taken = takenPayments(entries)
    const removed = removedIds(entries, 'tuu')
    for (const sale of group.terminal_sales) {
        if (removed.has(sale.id)) continue
        const only = autoPayment(item.payments_by_sale?.[String(sale.id)], taken)
        if (only !== null) {
            out[sale.id] = only
            taken.add(only)
        }
    }
    return Object.keys(out).length > 0 ? out : null
}

/**
 * Advertencias vigentes de una candidata según el borrador: «Ya tiene registro del SII» deja de
 * bloquear si el registro unido del grupo está por quitarse (el servidor quita antes de unir).
 */
export function warningsOf(entries: DraftEntry[], group: FiscalMatchDetail, part: FiscalMatchPart, item: FiscalMatchSearchItem): FiscalMatchWarning[] {
    if (part !== 'rcv' || group.rcv_documents.length === 0) return item.warnings
    const removed = removedIds(entries, 'rcv')
    if (!group.rcv_documents.every(d => removed.has(d.id))) return item.warnings
    return item.warnings.filter(w => w.code !== 'SECOND_RCV')
}

export function applySelect(
    entries: DraftEntry[],
    group: FiscalMatchDetail,
    part: FiscalMatchPart,
    item: FiscalMatchSearchItem,
): { entries: DraftEntry[]; result: SelectResult } {
    const blocking = warningsOf(entries, group, part, item).find(w => w.blocking)
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
        change.movement = autoPayment(item.compatible_movements, takenPayments(next))
    } else if (part === 'erp') {
        change.payments = ownPayments(next, group, item)
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

/** Antes de cada intento de guardado: los errores del intento anterior ya no valen. */
export function clearEntryErrors(entries: DraftEntry[]): DraftEntry[] {
    return entries.some(e => e.error) ? entries.map(e => (e.error ? { ...e, error: undefined } : e)) : entries
}

export function errorOf(entries: DraftEntry[], part: FiscalMatchPart, id: number): string | undefined {
    return entries.find(e => same(e, part, id))?.error
}

/**
 * Pagos entre los que elegir para una venta TUU: los de su propia tarjeta o, en un huérfano, los del
 * documento elegido; sin los que ya eligió otra venta del borrador.
 */
export function paymentOptionsOf(entries: DraftEntry[], saleId: number): CandidateMovement[] {
    const taken = takenPayments(entries, saleId)
    for (const e of entries) {
        if (e.change.op !== 'link') continue
        if (e.change.part === 'tuu' && e.change.id === saleId) return (e.item?.compatible_movements ?? []).filter(m => !taken.has(m.id))
        if (e.change.part === 'erp') {
            const options = e.item?.payments_by_sale?.[String(saleId)]
            if (options) return options.filter(m => !taken.has(m.id))
        }
    }
    return []
}

/** Etiqueta de un registro del grupo o de la tarjeta elegida. */
function labelOf(entry: DraftEntry, group: FiscalMatchDetail | undefined): string {
    if (entry.item) return entry.item.label
    const { part, id } = entry.change
    if (part === 'rcv') {
        const doc = group?.rcv_documents.find(d => d.id === id)
        if (doc) return `folio ${doc.folio}`
    }
    if (part === 'tuu') return `Venta TUU #${id}`
    if (part === 'erp' && group?.invoice?.id === id) return group.invoice.display_id
    return `#${id}`
}

/** Una línea por cambio en espera («Unir …», «Quitar …»), para el resumen del pie. */
export function summarize(entries: DraftEntry[], group: FiscalMatchDetail | undefined): string[] {
    return entries.map(e => `${e.change.op === 'link' ? 'Unir' : 'Quitar'} ${labelOf(e, group)}`)
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

/**
 * Cambios que viajan a `apply` (sin la tarjeta ni el error). Una venta propia del huérfano con
 * «Quitar» en espera sale antes de unir el documento: su pago no viaja.
 */
export function toBody(entries: DraftEntry[]): FiscalMatchChange[] {
    const removed = removedIds(entries, 'tuu')
    return entries.map(({ change }) => {
        if (change.part !== 'erp' || !change.payments || removed.size === 0) return change
        const kept = Object.entries(change.payments).filter(([saleId]) => !removed.has(Number(saleId)))
        return { ...change, payments: kept.length > 0 ? Object.fromEntries(kept.map(([k, v]) => [Number(k), v])) : null }
    })
}

/** Ventas TUU a las que les falta elegir el pago: no se puede guardar todavía. */
export function missingPaymentSales(entries: DraftEntry[], group: FiscalMatchDetail | undefined): number[] {
    const removed = removedIds(entries, 'tuu')
    return entries.flatMap(e => {
        if (e.change.op !== 'link') return []
        if (e.change.part === 'tuu') return e.change.movement == null ? [e.change.id] : []
        if (e.change.part !== 'erp' || !group) return []
        return group.terminal_sales
            .filter(s => !removed.has(s.id) && (e.item?.payments_by_sale?.[String(s.id)] ?? []).length > 0 && e.change.payments?.[s.id] == null)
            .map(s => s.id)
    })
}

const isBoleta = (dteType: number | null | undefined): boolean => dteType != null && BOLETA_TYPES.includes(dteType)

/** «La boleta SII …» en 39/41; «El registro SII …» en facturas y notas (33/34/56/61). */
const rcvMoves = (folio: string, dteType: number | null | undefined): string =>
    `${isBoleta(dteType) ? 'La boleta SII' : 'El registro SII'} folio ${folio} se moverá también`

/**
 * «Se moverá también»: al elegir un documento, los registros propios del huérfano viajan con él; al
 * unir una venta TUU, el RCV de su huérfano (del mismo tipo que este grupo). Sin repetir registros.
 */
export function consequencesOf(entries: DraftEntry[], group: FiscalMatchDetail | undefined): string[] {
    const seen = new Set<number>()
    const carried: string[] = []
    for (const r of carriedRcv(entries)) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        carried.push(rcvMoves(r.folio, group?.dte_type))
    }
    if (!group || !entries.some(e => e.change.part === 'erp' && e.change.op === 'link')) return carried
    // Lo que se quita en el mismo guardado no viaja con el documento.
    const removedRcv = removedIds(entries, 'rcv')
    const removedTuu = removedIds(entries, 'tuu')
    const rcv = group.rcv_documents.filter(r => !seen.has(r.id) && !removedRcv.has(r.id)).map(r => rcvMoves(r.folio, r.dte_type))
    const tuu = group.terminal_sales.filter(s => !removedTuu.has(s.id)).map(s => `La venta TUU #${s.id} se moverá también`)
    return [...tuu, ...rcv, ...carried]
}

/** Deja en el mapa de pagos del cambio ERP solo las ventas que siguen siendo del huérfano. */
function prunePayments(entry: DraftEntry, group: FiscalMatchDetail): DraftEntry {
    const payments = entry.change.payments
    if (entry.change.part !== 'erp' || !payments) return entry
    const own = new Set(group.terminal_sales.map(s => s.id))
    const kept = Object.entries(payments).filter(([saleId]) => own.has(Number(saleId)))
    if (kept.length === Object.keys(payments).length) return entry
    const next = kept.length > 0 ? Object.fromEntries(kept.map(([k, v]) => [Number(k), v])) : null
    return { ...entry, change: { ...entry.change, payments: next } }
}

/** Aviso de §7b para un cambio que se descarta porque su registro se movió. */
function noLongerApplies(e: DraftEntry): string {
    const { op, part, id } = e.change
    const label = e.item?.label ?? `#${id}`
    const why = op === 'unlink' ? 'ya no está unido a este grupo' : 'se cuadró en otro grupo'
    return `1 cambio ya no aplica: ${PART_NAME[part]} ${label} ${why}`
}

/** El servidor rechazó el cambio `index` porque su registro se movió (`MOVED`): sale del borrador con su aviso. */
export function dropEntry(entries: DraftEntry[], index: number): { entries: DraftEntry[]; notice: string | null } {
    const entry = entries[index]
    if (!entry) return { entries, notice: null }
    return { entries: entries.filter((_, i) => i !== index), notice: noLongerApplies(entry) }
}

/** Tarjetas elegidas para unir en una parte (se muestran aunque ya no estén en la búsqueda visible). */
export function pendingLinkItems(entries: DraftEntry[], part: FiscalMatchPart): FiscalMatchSearchItem[] {
    return entries.flatMap(e => (e.change.op === 'link' && e.change.part === part && e.item ? [e.item] : []))
}

/**
 * Descarta los cambios cuyo registro ya no está disponible tras un refresco (cuadrado en otro
 * grupo, grupo que dejó de ser huérfano, registro que ya no está unido) y devuelve los avisos.
 */
export function reconcileEntries(
    entries: DraftEntry[],
    group: FiscalMatchDetail,
    visible: VisibleIds,
): { entries: DraftEntry[]; notices: string[]; changed: boolean } {
    const sets = new Map<FiscalMatchPart, Set<number>>()
    for (const [part, ids] of Object.entries(visible) as [FiscalMatchPart, Iterable<number>][]) sets.set(part, new Set(ids))
    const notices: string[] = []
    const kept = entries.filter(e => {
        const { op, part, id } = e.change
        const gone =
            op === 'unlink'
                ? !linkedIds(group, part).includes(id)
                : (part === 'erp' && !isOrphan(group)) || (sets.has(part) && !sets.get(part)?.has(id))
        if (gone) notices.push(noLongerApplies(e))
        return !gone
    })
    const pruned = kept.map(e => prunePayments(e, group))
    return { entries: pruned, notices, changed: notices.length > 0 || pruned.some((e, i) => e !== kept[i]) }
}
