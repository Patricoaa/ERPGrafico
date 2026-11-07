import { describe, expect, it } from "vitest"
import { shouldKeepIdempotencyKey } from "../idempotency"

describe("shouldKeepIdempotencyKey", () => {
    it("keeps the key when no response arrived, since the operation may have been applied", () => {
        expect(shouldKeepIdempotencyKey(new Error("Network Error"))).toBe(true)
        expect(shouldKeepIdempotencyKey({ response: undefined })).toBe(true)
        expect(shouldKeepIdempotencyKey("timeout")).toBe(true)
    })

    it("keeps the key while the first request is still running", () => {
        expect(shouldKeepIdempotencyKey({ response: { status: 425 } })).toBe(true)
    })

    it("replaces the key after a rejection, which the backend would replay", () => {
        expect(shouldKeepIdempotencyKey({ response: { status: 400 } })).toBe(false)
        expect(shouldKeepIdempotencyKey({ response: { status: 409 } })).toBe(false)
        expect(shouldKeepIdempotencyKey({ response: { status: 500 } })).toBe(false)
    })
})
