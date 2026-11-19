import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useApplyInputMode, useTouchMode } from "../useTouchMode"

function mockPointer(coarse: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(pointer: coarse)" ? coarse : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    }))
}

describe("useTouchMode (ADR-0142 D5)", () => {
    beforeEach(() => {
        sessionStorage.clear()
        document.documentElement.removeAttribute("data-input")
    })
    afterEach(() => vi.unstubAllGlobals())

    it("defaults to auto: a mouse is not touch (no more default-true)", () => {
        mockPointer(false)
        const { result } = renderHook(() => useTouchMode())
        expect(result.current.inputMode).toBe("auto")
        expect(result.current.isTouchMode).toBe(false)
    })

    it("auto resolves to touch on a coarse pointer", () => {
        mockPointer(true)
        const { result } = renderHook(() => useTouchMode())
        expect(result.current.isTouchMode).toBe(true)
    })

    it("toggleTouchMode forces the opposite of the resolved mode and persists it", () => {
        mockPointer(false)
        const { result } = renderHook(() => useTouchMode())
        act(() => result.current.toggleTouchMode())
        expect(result.current.inputMode).toBe("touch")
        expect(result.current.isTouchMode).toBe(true)
        expect(sessionStorage.getItem("pos_input_mode")).toBe("touch")
        act(() => result.current.toggleTouchMode())
        expect(result.current.inputMode).toBe("mouse")
        expect(result.current.isTouchMode).toBe(false)
    })

    it("setInputMode('auto') clears the stored override", () => {
        mockPointer(false)
        const { result } = renderHook(() => useTouchMode())
        act(() => result.current.setInputMode("touch"))
        act(() => result.current.setInputMode("auto"))
        expect(sessionStorage.getItem("pos_input_mode")).toBeNull()
    })
})

describe("useApplyInputMode", () => {
    beforeEach(() => {
        sessionStorage.clear()
        document.documentElement.removeAttribute("data-input")
        mockPointer(false)
    })
    afterEach(() => vi.unstubAllGlobals())

    it("publishes the mode on <html data-input> and restores it on unmount", () => {
        const { unmount } = renderHook(() => useApplyInputMode())
        expect(document.documentElement.getAttribute("data-input")).toBe("auto")
        unmount()
        expect(document.documentElement.hasAttribute("data-input")).toBe(false)
    })
})
