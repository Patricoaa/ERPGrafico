import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

const state = vi.hoisted(() => ({
    debugTools: false,
    user: null as { is_superuser: boolean } | null,
}))

vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ debugTools: state.debugTools }) }))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }))

import { useDebugToolsAccess, visibleSettingsTabs } from "../useDebugToolsAccess"

describe("useDebugToolsAccess", () => {
    it("permite solo con debug_tools y superusuario", () => {
        state.debugTools = true
        state.user = { is_superuser: true }
        expect(renderHook(() => useDebugToolsAccess()).result.current).toBe(true)
    })

    it("niega sin debug_tools", () => {
        state.debugTools = false
        state.user = { is_superuser: true }
        expect(renderHook(() => useDebugToolsAccess()).result.current).toBe(false)
    })

    it("niega a un usuario que no es superusuario", () => {
        state.debugTools = true
        state.user = { is_superuser: false }
        expect(renderHook(() => useDebugToolsAccess()).result.current).toBe(false)
    })
})

describe("visibleSettingsTabs", () => {
    const tabs = [{ value: "jobs" }, { value: "debug" }]
    it("oculta la pestaña Depuración sin acceso", () => {
        expect(visibleSettingsTabs(tabs, false).map((t) => t.value)).toEqual(["jobs"])
    })
    it("la muestra con acceso", () => {
        expect(visibleSettingsTabs(tabs, true).map((t) => t.value)).toEqual(["jobs", "debug"])
    })
})
