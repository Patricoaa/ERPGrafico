import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"

import { ModuleSidebarPanel } from "../ModuleSidebarPanel"

const mocks = vi.hoisted(() => ({
    openTool: vi.fn(),
    can: vi.fn((permission: string | null) => permission !== "__deny__"),
    pathname: "/sales/docs",
}))

vi.mock("next/navigation", () => ({
    usePathname: () => mocks.pathname,
    useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/contexts/BrandingProvider", () => ({
    useBranding: () => ({ logo: null, company: { trade_name: "ACME S.A." } }),
}))
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({ user: { username: "pato" }, can: mocks.can, logout: vi.fn() }),
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openTool: mocks.openTool, tabs: [] }),
}))
vi.mock("@/features/notifications/hooks/useNotifications", () => ({ useNotifications: () => {} }))
vi.mock("@/features/workflow", () => ({ getTasks: () => Promise.resolve([]) }))
vi.mock("@/features/search", () => ({ useUniversalSearch: () => ({ results: [], isLoading: false }) }))
vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UniversalSearch: ({ renderTrigger }: { renderTrigger?: (open: () => void) => React.ReactNode }) => (
            <>{renderTrigger?.(() => {})}</>
        ),
    }
})

const navigation: NavigationConfig = {
    moduleName: "Ventas",
    tabs: [{ value: "docs", label: "Documentos", href: "/sales/docs" }],
    activeValue: "docs",
}

const renderPanel = (props: Partial<React.ComponentProps<typeof ModuleSidebarPanel>> = {}) =>
    render(
        <ModuleSidebarPanel
            currentModuleId="sales"
            navigation={navigation}
            onProfileOpen={vi.fn()}
            {...props}
        />
    )

/** ADR-0162: el orden de los bloques es parte del contrato del panel. */
describe("ModuleSidebarPanel", () => {
    beforeEach(() => {
        mocks.can.mockImplementation(() => true)
        mocks.openTool.mockReset()
        mocks.pathname = "/sales/docs"
    })

    it("shows the company identity in the header, with the name as fallback when there is no logo", () => {
        renderPanel()
        expect(screen.getByText("ACME S.A.")).toBeInTheDocument()
        expect(screen.queryByText("AC")).toBeNull()
        expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument()
    })

    it("puts POS and the cost calculator right below the inbox, with no separator between them", () => {
        renderPanel()
        const rows = [
            screen.getByText("Buscar"),
            screen.getByText("Bandeja de entrada"),
            screen.getByText("Punto de Venta"),
            screen.getByText("Calculadora de Costos"),
            screen.getByRole("button", { name: "Contabilidad" }),
        ]
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i - 1].compareDocumentPosition(rows[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        }
        const utilities = screen.getByText("Buscar").closest("div.flex.flex-col.gap-px")?.parentElement
        expect(Array.from(utilities?.children ?? []).some(el => el.classList.contains("h-px"))).toBe(false)
    })

    it("lists every module as a first-level accordion with no direct link", () => {
        renderPanel()
        const nav = screen.getByRole("navigation", { name: "Módulos y vistas" })
        const moduleLabels = ["Contabilidad", "Ventas", "Contactos", "Inventario", "Producción", "Tesorería", "Compras", "Finanzas", "RRHH"]
        for (const label of moduleLabels) {
            expect(within(nav).getByRole("button", { name: label })).toHaveAttribute("aria-expanded")
            expect(within(nav).queryByRole("link", { name: label })).toBeNull()
        }
        expect(within(nav).getByRole("button", { name: "Ventas" })).toHaveAttribute("aria-expanded", "true")
        expect(within(nav).getByRole("link", { name: "Documentos" })).toHaveAttribute("aria-current", "page")
    })

    it("collapses and expands the active module's views from the first level", () => {
        renderPanel()
        const nav = screen.getByRole("navigation", { name: "Módulos y vistas" })
        const active = within(nav).getByRole("button", { name: "Ventas" })
        fireEvent.click(active)
        expect(active).toHaveAttribute("aria-expanded", "false")
        expect(within(nav).queryByRole("link", { name: "Documentos" })).toBeNull()
        fireEvent.click(active)
        expect(active).toHaveAttribute("aria-expanded", "true")
        expect(within(nav).getByRole("link", { name: "Documentos" })).toHaveAttribute("aria-current", "page")
    })

    it("expands any inactive module and shows its views without navigating", () => {
        renderPanel()
        const nav = screen.getByRole("navigation", { name: "Módulos y vistas" })
        const accounting = within(nav).getByRole("button", { name: "Contabilidad" })
        expect(accounting).toHaveAttribute("aria-expanded", "false")
        expect(within(nav).queryByRole("link", { name: "Plan de Cuentas" })).toBeNull()

        fireEvent.click(accounting)
        expect(accounting).toHaveAttribute("aria-expanded", "true")
        expect(within(nav).getByRole("link", { name: "Plan de Cuentas" })).toHaveAttribute("href", "/accounting/ledger")
        expect(within(nav).getByRole("button", { name: "Ventas" })).toHaveAttribute("aria-expanded", "true")

        fireEvent.click(accounting)
        expect(accounting).toHaveAttribute("aria-expanded", "false")
        expect(within(nav).queryByRole("link", { name: "Plan de Cuentas" })).toBeNull()
    })

    it("hides modules and POS without permission", () => {
        mocks.can.mockImplementation((permission: string | null) => permission !== "sales.view_dashboard_sales" && permission !== "inventory.view_dashboard_inventory")
        renderPanel()
        expect(screen.queryByText("Punto de Venta")).toBeNull()
        expect(screen.queryByRole("button", { name: "Inventario" })).toBeNull()
        expect(screen.getByRole("button", { name: "Contabilidad" })).toBeInTheDocument()
    })

    it("opens the cost calculator and keeps Configuración and Cuenta in the footer", () => {
        renderPanel()
        fireEvent.click(screen.getByText("Calculadora de Costos"))
        expect(mocks.openTool).toHaveBeenCalledWith("cost-calculator")
        expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("href", "/settings")
        const cuenta = screen.getByRole("button", { name: /Cuenta/ })
        expect(cuenta).toBeInTheDocument()
        expect(cuenta.querySelector(".lucide-chevron-right")).toBeNull()
    })
})
