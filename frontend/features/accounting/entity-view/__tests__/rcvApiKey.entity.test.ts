import { describe, expect, it } from "vitest"
import { rcvKeyExhaustion } from "../rcvApiKey.entity"

const now = new Date(2026, 10, 14, 15, 0, 0)

describe("rcvKeyExhaustion", () => {
    it("no muestra nada sin fecha o con fecha pasada", () => {
        expect(rcvKeyExhaustion({ exhausted_until: null }, now)).toBe("")
        expect(rcvKeyExhaustion({ exhausted_until: "2026-11-13" }, now)).toBe("")
    })
    it("muestra 'Sin cupo hasta' si la fecha es hoy o posterior", () => {
        expect(rcvKeyExhaustion({ exhausted_until: "2026-11-14" }, now)).toMatch(/^Sin cupo hasta /)
        expect(rcvKeyExhaustion({ exhausted_until: "2026-12-01" }, now)).toMatch(/^Sin cupo hasta /)
    })
})
