import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const state = vi.hoisted(() => ({
    value: { debugClock: false, datetime: null as string | null, timezone: null as string | null },
}))

vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => state.value }))

import { DebugClockBanner } from "../DebugClockBanner"

describe("DebugClockBanner", () => {
    it("muestra la hora del servidor en hora de Santiago cuando el reloj está alterado", () => {
        state.value = { debugClock: true, datetime: "2026-11-13T20:35:00+00:00", timezone: "America/Santiago" }
        render(<DebugClockBanner />)
        expect(screen.getByText("Reloj de depuración: 13-11-2026 17:35")).toBeTruthy()
        const bar = screen.getByRole("status")
        expect(bar.className).toContain("shrink-0")
        expect(bar.className).not.toMatch(/fixed|pointer-events-none/)
    })

    it("no se renderiza con debug_clock falso", () => {
        state.value = { debugClock: false, datetime: "2026-11-13T20:35:00+00:00", timezone: "America/Santiago" }
        const { container } = render(<DebugClockBanner />)
        expect(container.firstChild).toBeNull()
    })

    it("no se renderiza sin el campo ni la hora", () => {
        state.value = { debugClock: false, datetime: null, timezone: null }
        const { container } = render(<DebugClockBanner />)
        expect(container.firstChild).toBeNull()
    })
})
