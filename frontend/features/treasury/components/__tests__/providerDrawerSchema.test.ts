import { describe, expect, it } from "vitest"
import { providerSchema } from "../providerDrawerSchema"

const base = { name: "TUU Caja", provider_type: "TUU" }

describe("providerSchema api_key", () => {
    it("is optional", () => {
        expect(providerSchema.safeParse(base).success).toBe(true)
    })

    it("accepts an empty string and a value", () => {
        expect(providerSchema.safeParse({ ...base, api_key: "" }).success).toBe(true)
        expect(providerSchema.safeParse({ ...base, api_key: "abc" }).success).toBe(true)
    })
})
