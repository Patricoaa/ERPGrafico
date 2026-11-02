import { afterEach, describe, expect, it, vi } from "vitest"
import { generateUuidV4 } from "../uuid"

describe("generateUuidV4", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("uses randomUUID when available", () => {
        const randomUUID = vi.fn(() => "11111111-2222-4333-8444-555555555555")
        vi.stubGlobal("crypto", { randomUUID })

        expect(generateUuidV4()).toBe("11111111-2222-4333-8444-555555555555")
        expect(randomUUID).toHaveBeenCalledOnce()
    })

    it("generates a valid UUID v4 with getRandomValues when randomUUID is unavailable", () => {
        const getRandomValues = vi.fn((bytes: Uint8Array) => {
            bytes.fill(0)
            return bytes
        })
        vi.stubGlobal("crypto", { getRandomValues })

        expect(generateUuidV4()).toBe("00000000-0000-4000-8000-000000000000")
        expect(getRandomValues).toHaveBeenCalledOnce()
    })

    it("fails closed when no secure random source exists", () => {
        vi.stubGlobal("crypto", undefined)

        expect(() => generateUuidV4()).toThrow("A secure random source is required to generate a UUID")
    })
})
