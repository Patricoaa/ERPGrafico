import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useIdempotencyKey } from "../useIdempotencyKey"

describe("useIdempotencyKey", () => {
    it("reutiliza la clave con el mismo payload (doble clic / reintento)", () => {
        const { result } = renderHook(() => useIdempotencyKey())
        const first = result.current.keyFor({ a: 1 })
        expect(result.current.keyFor({ a: 1 })).toBe(first)
    })
    it("renueva si el payload cambia", () => {
        const { result } = renderHook(() => useIdempotencyKey())
        const first = result.current.keyFor({ a: 1 })
        expect(result.current.keyFor({ a: 2 })).not.toBe(first)
    })
    it("renueva tras éxito", () => {
        const { result } = renderHook(() => useIdempotencyKey())
        const first = result.current.keyFor({ a: 1 })
        result.current.succeeded()
        expect(result.current.keyFor({ a: 1 })).not.toBe(first)
    })
    it("conserva la clave si el fallo es incierto y la renueva si el servidor rechazó", () => {
        const { result } = renderHook(() => useIdempotencyKey())
        const first = result.current.keyFor({ a: 1 })
        result.current.failed(new Error("network"))
        expect(result.current.keyFor({ a: 1 })).toBe(first)
        result.current.failed({ response: { status: 400 } })
        expect(result.current.keyFor({ a: 1 })).not.toBe(first)
    })
})
