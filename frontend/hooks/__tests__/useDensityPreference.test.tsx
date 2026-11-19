import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useApplyDensityPreference, useDensityPreference } from "../useDensityPreference"

describe("useDensityPreference (ADR-0142)", () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute("data-density")
    })

    it("defaults to compact", () => {
        const { result } = renderHook(() => useDensityPreference())
        expect(result.current.density).toBe("compact")
    })

    it("persists comfortable and clears the key when going back to compact", () => {
        const { result } = renderHook(() => useDensityPreference())
        act(() => result.current.setDensity("comfortable"))
        expect(result.current.density).toBe("comfortable")
        expect(localStorage.getItem("ui_density")).toBe("comfortable")
        act(() => result.current.setDensity("compact"))
        expect(result.current.density).toBe("compact")
        expect(localStorage.getItem("ui_density")).toBeNull()
    })

    it("useApplyDensityPreference mirrors the preference on <html data-density>", () => {
        const { result } = renderHook(() => ({ apply: useApplyDensityPreference(), pref: useDensityPreference() }))
        expect(document.documentElement.hasAttribute("data-density")).toBe(false)
        act(() => result.current.pref.setDensity("comfortable"))
        expect(document.documentElement.getAttribute("data-density")).toBe("comfortable")
    })
})
