/**
 * AuthContext: hasPermission must NOT grant access by group name.
 * Task 8 — RBAC Phase 1: remove the `user.groups?.includes('ADMIN')` shortcut.
 *
 * Failing test: a user with groups:['ADMIN'] and no permissions should get
 * hasPermission('x.y') === false (current code returns true).
 */
import { render, screen, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"

// ── hoisted mocks ──────────────────────────────────────────────────────────
const { getCurrentUserMock } = vi.hoisted(() => ({
    getCurrentUserMock: vi.fn(),
}))

vi.mock("@/features/auth/api/authApi", () => ({
    authApi: {
        getCurrentUser: getCurrentUserMock,
        logout: vi.fn().mockResolvedValue(undefined),
    },
}))

vi.mock("@/lib/client-token", () => ({
    getClientToken: () => "fake-token",
    setClientToken: vi.fn(),
    removeClientTokens: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next-themes", () => ({
    useTheme: () => ({ setTheme: vi.fn(), theme: "system" }),
}))

vi.mock("sonner", () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/lib/api", () => ({
    default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    AUTH_UNAUTHORIZED_EVENT: "auth:unauthorized",
}))

// ── helpers ──────────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from "../AuthContext"

function PermissionConsumer({ permission }: { permission: string }) {
    const { hasPermission, isLoading } = useAuth()
    if (isLoading) return <span>loading</span>
    return <span data-testid="result">{String(hasPermission(permission))}</span>
}

function renderWithAuth(permission: string) {
    return render(
        <AuthProvider>
            <PermissionConsumer permission={permission} />
        </AuthProvider>
    )
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe("AuthContext.hasPermission — group-name bypass removed", () => {
    it("does not grant access when user has groups=['ADMIN'] but no permissions", async () => {
        getCurrentUserMock.mockResolvedValue({
            id: 1,
            username: "admin-user",
            first_name: "",
            last_name: "",
            email: "",
            is_superuser: false,
            groups: ["ADMIN"],   // OLD system role — must NOT grant access after Task 8
            permissions: [],
            theme: "system",
        })

        renderWithAuth("sales.add_saleorder")

        await waitFor(() => {
            expect(screen.getByTestId("result").textContent).toBe("false")
        })
    })

    it("grants access when user is_superuser regardless of groups/permissions", async () => {
        getCurrentUserMock.mockResolvedValue({
            id: 2,
            username: "superuser",
            first_name: "",
            last_name: "",
            email: "",
            is_superuser: true,
            groups: [],
            permissions: [],
            theme: "system",
        })

        renderWithAuth("any.permission")

        await waitFor(() => {
            expect(screen.getByTestId("result").textContent).toBe("true")
        })
    })

    it("grants access when permission is in user.permissions array", async () => {
        getCurrentUserMock.mockResolvedValue({
            id: 3,
            username: "op",
            first_name: "",
            last_name: "",
            email: "",
            is_superuser: false,
            groups: ["Ventas"],
            permissions: ["sales.add_saleorder"],
            theme: "system",
        })

        renderWithAuth("sales.add_saleorder")

        await waitFor(() => {
            expect(screen.getByTestId("result").textContent).toBe("true")
        })
    })
})
