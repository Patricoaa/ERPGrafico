import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "../useIsMobile"

interface MediaStub {
    matches: boolean
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
}

function mockViewport(matches: boolean): MediaStub {
    const media: MediaStub = {
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }
    vi.stubGlobal("matchMedia", (query: string) => {
        expect(query).toBe("(max-width: 767px)")
        return media
    })
    return media
}

afterEach(() => vi.unstubAllGlobals())

describe("useIsMobile (ADR-0158 §2)", () => {
    it("reads the narrow viewport from the media query", () => {
        mockViewport(true)
        expect(renderHook(() => useIsMobile()).result.current).toBe(true)
    })

    it("stays wide when matchMedia is unavailable (SSR/jsdom fallback)", () => {
        vi.stubGlobal("matchMedia", undefined)
        expect(renderHook(() => useIsMobile()).result.current).toBe(false)
    })

    it("follows viewport changes and unsubscribes on unmount", () => {
        const media = mockViewport(false)
        const { result, unmount } = renderHook(() => useIsMobile())
        expect(result.current).toBe(false)

        const listeners = media.addEventListener.mock.calls.find(([event]) => event === "change")
        expect(listeners).toBeDefined()
        const onChange = listeners?.[1] as () => void
        media.matches = true
        act(() => onChange())
        expect(result.current).toBe(true)

        unmount()
        expect(media.removeEventListener).toHaveBeenCalledWith("change", onChange)
    })
})
