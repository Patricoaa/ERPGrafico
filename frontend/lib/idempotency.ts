/**
 * Whether a failed request must be retried with the same `Idempotency-Key`.
 *
 * Keep it when the outcome is unknown: without a response the server may have applied the
 * operation, and 425 means it is still running. Replace it after any other response, because the
 * backend stores rejections too and would replay the same error for that key.
 */
export function shouldKeepIdempotencyKey(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("response" in error)) return true
    const { response } = error
    if (typeof response !== "object" || response === null || !("status" in response)) return true
    return response.status === 425
}
