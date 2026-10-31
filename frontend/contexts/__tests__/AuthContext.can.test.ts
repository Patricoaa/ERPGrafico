/**
 * TDD tests for can() on AuthContext.
 * These tests will FAIL before can() is added to AuthContextType and AuthProvider.
 */
import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import React from "react"

// We'll test the can() function exported from AuthContext by probing
// the AuthContextType shape through TypeScript.
// The simplest way: import AuthContextType and verify can() is a function.

// Rather than a full integration test (which needs axios mocks), we test
// the can() logic via a focused wrapper that simulates authenticated state.
// If `can` is not on the context object, TypeScript will error on type-check
// and the import will fail at runtime (undefined).

// Import AuthContext internals to test can():
import { AuthProvider, useAuth } from "../AuthContext"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn(), theme: "system" }) }))
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn(), interceptors: { response: { use: vi.fn() }, request: { use: vi.fn() } } }, AUTH_UNAUTHORIZED_EVENT: "auth:unauthorized" }))
vi.mock("@/lib/client-token", () => ({ getClientToken: vi.fn(() => null), setClientToken: vi.fn(), removeClientTokens: vi.fn() }))
vi.mock("@/features/auth/api/authApi", () => ({ authApi: { getCurrentUser: vi.fn(), logout: vi.fn() } }))

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthProvider, null, children)

describe("can() — AuthContext", () => {
    it("can() is exposed on the auth context", () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(typeof result.current.can).toBe("function")
    })

    it("can() returns false when not authenticated", () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.can("sales.view_dashboard_sales")).toBe(false)
    })
})
