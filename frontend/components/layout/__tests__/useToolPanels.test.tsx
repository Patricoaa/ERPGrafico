import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useToolPanels } from "../useToolPanels"

describe("useToolPanels", () => {
    it("abre un panel, cambia a otro y cierra el activo con un segundo clic", () => {
        const { result } = renderHook(() => useToolPanels())
        act(() => result.current.togglePanel("calculator"))
        expect(result.current.activePanel).toBe("calculator")
        act(() => result.current.togglePanel("inbox"))
        expect(result.current.activePanel).toBe("inbox")
        act(() => result.current.togglePanel("inbox"))
        expect(result.current.activePanel).toBeNull()
    })

    it("la calculadora queda montada tras su primera apertura para conservar su estado", () => {
        const { result } = renderHook(() => useToolPanels())
        expect(result.current.hasOpenedCalculator).toBe(false)
        act(() => result.current.togglePanel("calculator"))
        act(() => result.current.closePanel())
        expect(result.current.activePanel).toBeNull()
        expect(result.current.hasOpenedCalculator).toBe(true)
    })

    it("abrir el buscador cierra el panel activo para que el diálogo quede encima", () => {
        const { result } = renderHook(() => useToolPanels())
        act(() => result.current.togglePanel("inbox"))
        act(() => result.current.setSearchOpen(true))
        expect(result.current.isSearchOpen).toBe(true)
        expect(result.current.activePanel).toBeNull()
    })
})
