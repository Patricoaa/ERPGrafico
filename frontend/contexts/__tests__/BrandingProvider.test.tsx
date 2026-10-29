import { render, screen, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { BrandingProvider, useBranding } from "../BrandingProvider"

const mockBranding = {
    name: "ACME Ltda",
    trade_name: "ACME",
    logo: "/media/company/logos/logo.png",
    logo_url: "https://cdn.example.com/logo.png",
}

vi.mock("@/features/settings", () => ({
    useCompanyBranding: () => ({ branding: mockBranding, isLoading: false }),
}))

vi.mock("@/lib/media-url", () => ({
    resolveMediaUrl: (url: string | null | undefined) => url ?? null,
}))

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
})

function Consumer() {
    const { logo, company } = useBranding()
    return (
        <div>
            <span data-testid="name">{company?.name}</span>
            <span data-testid="trade">{company?.trade_name}</span>
            <span data-testid="logo">{logo}</span>
        </div>
    )
}

function wrapper({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <BrandingProvider>{children}</BrandingProvider>
        </QueryClientProvider>
    )
}

describe("BrandingProvider", () => {
    it("exposes company name, trade_name and logo from branding endpoint", async () => {
        render(<Consumer />, { wrapper })

        await waitFor(() => {
            expect(screen.getByTestId("name").textContent).toBe("ACME Ltda")
        })
        expect(screen.getByTestId("trade").textContent).toBe("ACME")
        expect(screen.getByTestId("logo").textContent).toBe("/media/company/logos/logo.png")
    })

    it("throws when used outside provider", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
        expect(() => render(<Consumer />)).toThrow(
            "useBranding must be used within a BrandingProvider"
        )
        spy.mockRestore()
    })
})
