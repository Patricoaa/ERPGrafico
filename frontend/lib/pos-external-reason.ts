/**
 * Uso externo de una caja POS con sesión abierta (ADR-0109).
 *
 * Cuando un movimiento toca una caja con sesión POS abierta desde fuera de esa
 * sesión, el backend responde con error y el header
 * `X-POS-External-Reason-Required`. El interceptor de `lib/api` pide el motivo
 * al handler registrado (un diálogo montado en los shells) y reintenta la
 * request con `X-POS-External-Reason`.
 */
import type { InternalAxiosRequestConfig } from 'axios';

export const POS_EXTERNAL_REASON_HEADER = 'X-POS-External-Reason';
export const POS_EXTERNAL_REASON_CHALLENGE_HEADER = 'x-pos-external-reason-required';

export interface PosExternalReasonChallenge {
    session_id: number
    account_id: number
    account_name: string
    terminal_name: string
    cashier_name: string
    opened_at: string
}

/** Devuelve el motivo escrito, o `null` si el usuario canceló. */
export type PosExternalReasonHandler = (challenge: PosExternalReasonChallenge) => Promise<string | null>;

let handler: PosExternalReasonHandler | null = null;

export function registerPosExternalReasonHandler(next: PosExternalReasonHandler): () => void {
    handler = next;
    return () => {
        if (handler === next) handler = null;
    };
}

function isChallenge(value: unknown): value is PosExternalReasonChallenge {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v.session_id === 'number' && typeof v.account_name === 'string';
}

export function parsePosExternalReasonChallenge(raw: unknown): PosExternalReasonChallenge | null {
    if (typeof raw !== 'string' || !raw) return null;
    try {
        const parsed: unknown = JSON.parse(decodeURIComponent(raw));
        return isChallenge(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** UUID v4; `crypto.randomUUID` no existe fuera de contextos seguros (dev server por http). */
function newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

type RetriableConfig = InternalAxiosRequestConfig & { _posExternalReasonRetry?: boolean };

/**
 * Si la request fue rechazada por falta de motivo, lo pide y devuelve la config
 * lista para reintentar; `null` si no aplica o el usuario canceló.
 */
export async function preparePosExternalReasonRetry(
    config: RetriableConfig | undefined,
    challengeHeader: unknown,
): Promise<RetriableConfig | null> {
    if (!config || config._posExternalReasonRetry || !handler) return null;
    const challenge = parsePosExternalReasonChallenge(challengeHeader);
    if (!challenge) return null;

    const reason = await handler(challenge);
    if (!reason) return null;

    config._posExternalReasonRetry = true;
    config.headers.set(POS_EXTERNAL_REASON_HEADER, encodeURIComponent(reason));
    // El intento rechazado no tuvo efectos, pero el backend cachea su 400 bajo
    // la misma clave de idempotencia: el reintento necesita una clave nueva.
    if (config.headers.has('Idempotency-Key')) {
        config.headers.set('Idempotency-Key', newIdempotencyKey());
    }
    return config;
}
