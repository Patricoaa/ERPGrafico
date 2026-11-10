/**
 * Operador identificado en cajas POS multiusuario (spec 2026-11-10).
 *
 * Módulo neutral (sin dependencias de features) que cruza la barrera Axios → React:
 * - guarda los encabezados que `lib/api` agrega a cada request (pase de operador y
 *   contexto de documento);
 * - cuando el backend responde 403 `pos_operator_required`, pide al manejador
 *   registrado por el POS que identifique al operador y reintenta la request una vez.
 */
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { generateUuidV4 } from './uuid'

export type OperatorPurpose = 'DRAFT' | 'CASH_MOVEMENT' | 'SESSION_CLOSE' | 'PARTNER_WITHDRAWAL' | 'DOCUMENT_EDIT'

export const POS_OPERATOR_PASS_HEADER = 'X-POS-Operator-Pass'
export const POS_DOCUMENT_CONTEXT_HEADER = 'X-POS-Document-Context'
const REQUIRED_CODE = 'pos_operator_required'
const PURPOSES: readonly OperatorPurpose[] = ['DRAFT', 'CASH_MOVEMENT', 'SESSION_CLOSE', 'PARTNER_WITHDRAWAL', 'DOCUMENT_EDIT']

export interface PosOperatorHeaders {
    /** Token del pase de operador vigente. */
    pass?: string
    /** Id de la sesión POS mientras hay un documento abierto en el panel de ventas. */
    documentContext?: number
}

let current: PosOperatorHeaders = {}

/**
 * Fija los encabezados. `null` limpia todo; un valor `undefined` quita solo esa clave;
 * las claves ausentes no se tocan (pase y contexto los fijan consumidores distintos).
 */
export function setPosOperatorHeaders(next: PosOperatorHeaders | null): void {
    if (next === null) {
        current = {}
        return
    }
    const merged: PosOperatorHeaders = { ...current }
    if ('pass' in next) {
        if (next.pass === undefined) delete merged.pass
        else merged.pass = next.pass
    }
    if ('documentContext' in next) {
        if (next.documentContext === undefined) delete merged.documentContext
        else merged.documentContext = next.documentContext
    }
    current = merged
}

export function getPosOperatorHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (current.pass !== undefined) headers[POS_OPERATOR_PASS_HEADER] = current.pass
    if (current.documentContext !== undefined) headers[POS_DOCUMENT_CONTEXT_HEADER] = String(current.documentContext)
    return headers
}

export interface PosOperatorChallengeRequest {
    /** URL (relativa) de la request rechazada: permite deducir el borrador afectado. */
    url?: string
}

/** Devuelve `true` si se identificó a un operador (hay pase nuevo), `false` si se canceló. */
export type PosOperatorChallengeHandler = (
    purpose: OperatorPurpose,
    request: PosOperatorChallengeRequest,
) => Promise<boolean>

let handler: PosOperatorChallengeHandler | null = null

export function setPosOperatorChallengeHandler(next: PosOperatorChallengeHandler | null): void {
    handler = next
}

export async function runPosOperatorChallenge(
    purpose: OperatorPurpose,
    request: PosOperatorChallengeRequest = {},
): Promise<boolean> {
    return handler ? handler(purpose, request) : false
}

function isPurpose(value: unknown): value is OperatorPurpose {
    return typeof value === 'string' && (PURPOSES as readonly string[]).includes(value)
}

/** Propósito pedido por el backend si el error es un 403 `pos_operator_required`; si no, `null`. */
export function parsePosOperatorRequired(error: AxiosError): OperatorPurpose | null {
    if (error.response?.status !== 403) return null
    const data: unknown = error.response.data
    if (typeof data !== 'object' || data === null) return null
    const wrapped = (data as { error?: unknown }).error
    if (typeof wrapped !== 'object' || wrapped === null) return null
    const details: unknown = (wrapped as { details?: unknown }).details
    if (typeof details !== 'object' || details === null) return null
    const { code, purpose } = details as { code?: unknown; purpose?: unknown }
    return code === REQUIRED_CODE && isPurpose(purpose) ? purpose : null
}

type RetriableConfig = InternalAxiosRequestConfig & { _posOperatorRetry?: boolean }

/**
 * Pide operador y devuelve la config lista para reintentar (la request vuelve a pasar
 * por el interceptor, que agrega el pase nuevo); `null` si no aplica o se canceló.
 */
export async function preparePosOperatorRetry(
    config: RetriableConfig | undefined,
    purpose: OperatorPurpose,
): Promise<RetriableConfig | null> {
    if (!config || config._posOperatorRetry) return null
    const identified = await runPosOperatorChallenge(purpose, { url: config.url })
    if (!identified) return null
    config._posOperatorRetry = true
    // El intento rechazado quedó registrado bajo su clave de idempotencia: usar una nueva.
    if (config.headers.has('Idempotency-Key')) {
        config.headers.set('Idempotency-Key', generateUuidV4())
    }
    return config
}
