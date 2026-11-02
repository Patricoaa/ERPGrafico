import { afterEach, describe, expect, it, vi } from "vitest"
import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios"
import {
    POS_EXTERNAL_REASON_HEADER,
    parsePosExternalReasonChallenge,
    preparePosExternalReasonRetry,
    registerPosExternalReasonHandler,
} from "../pos-external-reason"

const challenge = {
    session_id: 12,
    account_id: 3,
    account_name: "Caja 1",
    terminal_name: "Mesón",
    cashier_name: "Cajero",
    opened_at: "2026-11-01T09:00:00",
}
const header = encodeURIComponent(JSON.stringify(challenge))

function config(headers: Record<string, string> = {}): InternalAxiosRequestConfig {
    return { headers: new AxiosHeaders(headers) }
}

let unregister: (() => void) | null = null
afterEach(() => {
    unregister?.()
    unregister = null
})

describe("POS external reason challenge (ADR-0109)", () => {
    it("parses the encoded challenge header and rejects garbage", () => {
        expect(parsePosExternalReasonChallenge(header)).toEqual(challenge)
        expect(parsePosExternalReasonChallenge("%7Bnope")).toBeNull()
        expect(parsePosExternalReasonChallenge(undefined)).toBeNull()
    })

    it("retries with the reason and a fresh idempotency key", async () => {
        const handler = vi.fn().mockResolvedValue("Pago a proveedor")
        unregister = registerPosExternalReasonHandler(handler)

        const retry = await preparePosExternalReasonRetry(config({ "Idempotency-Key": "k-1" }), header)

        expect(handler).toHaveBeenCalledWith(challenge)
        expect(retry?.headers.get(POS_EXTERNAL_REASON_HEADER)).toBe(encodeURIComponent("Pago a proveedor"))
        expect(retry?.headers.get("Idempotency-Key")).not.toBe("k-1")
    })

    it("does not retry when the user cancels, twice, or nobody listens", async () => {
        expect(await preparePosExternalReasonRetry(config(), header)).toBeNull()

        unregister = registerPosExternalReasonHandler(vi.fn().mockResolvedValue(null))
        expect(await preparePosExternalReasonRetry(config(), header)).toBeNull()

        unregister()
        unregister = registerPosExternalReasonHandler(vi.fn().mockResolvedValue("ok"))
        const retried = await preparePosExternalReasonRetry(config(), header)
        expect(await preparePosExternalReasonRetry(retried ?? undefined, header)).toBeNull()
    })
})
