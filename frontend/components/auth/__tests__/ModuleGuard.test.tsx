import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"

const mockReplace = vi.fn()

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: mockReplace }),
}))

// Mock AuthContext — returns a controllable can() and isLoading
const mockCan = vi.fn((p: string) => p === "allowed.permission")
let mockIsLoading = false

vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({ can: mockCan, isLoading: mockIsLoading }),
}))

import { ModuleGuard } from "../ModuleGuard"

describe("ModuleGuard", () => {
    beforeEach(() => {
        mockReplace.mockReset()
        mockCan.mockReset()
        mockCan.mockImplementation((p: string) => p === "allowed.permission")
        mockIsLoading = false
    })

    it("renders children when can(permission) is true", () => {
        render(
            <ModuleGuard permission="allowed.permission">
                <span>Protected Content</span>
            </ModuleGuard>
        )
        expect(screen.getByText("Protected Content")).toBeTruthy()
    })

    it("redirects to /403 when can(permission) is false", async () => {
        render(
            <ModuleGuard permission="forbidden.permission">
                <span>Should Not See</span>
            </ModuleGuard>
        )
        // After effect runs, replace should be called
        await vi.waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith("/403")
        })
    })

    it("passes through when permission is null", () => {
        render(
            <ModuleGuard permission={null}>
                <span>Public Content</span>
            </ModuleGuard>
        )
        expect(screen.getByText("Public Content")).toBeTruthy()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it("renders null while isLoading", () => {
        mockIsLoading = true
        const { container } = render(
            <ModuleGuard permission="allowed.permission">
                <span>Loading Content</span>
            </ModuleGuard>
        )
        expect(container.firstChild).toBeNull()
    })
})
