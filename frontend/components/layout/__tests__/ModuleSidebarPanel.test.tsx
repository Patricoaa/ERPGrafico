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

    it("shows the company identity in the header instead of the module name", () => {
        renderPanel()
        expect(screen.getByText("ACME S.A.")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument()
    })

    it("puts POS and the cost calculator right below the inbox, before the module list", () => {
        renderPanel()
        const rows = [
            screen.getByText("Buscar"),
            screen.getByText("Bandeja de entrada"),
            screen.getByText("Punto de Venta"),
            screen.getByText("Calculadora de Costos"),
            screen.getByRole("link", { name: "Contabilidad" }),
        ]
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i - 1].compareDocumentPosition(rows[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        }
    })

    it("lists every module as the first level and nests only the active module's views", () => {
        renderPanel()
        const nav = screen.getByRole("navigation", { name: "Módulos y vistas" })
        expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(
            expect.arrayContaining(["Contabilidad", "Ventas", "Contactos", "Inventario", "Producción", "Tesorería", "Compras", "Finanzas", "RRHH"])
        )
        const views = within(nav).getByRole("link", { name: "Documentos" })
        expect(views).toHaveAttribute("aria-current", "page")
    })

    it("hides modules and POS without permission", () => {
        mocks.can.mockImplementation((permission: string | null) => permission !== "sales.view_dashboard_sales" && permission !== "inventory.view_dashboard_inventory")
        renderPanel()
        expect(screen.queryByText("Punto de Venta")).toBeNull()
        expect(screen.queryByRole("link", { name: "Inventario" })).toBeNull()
        expect(screen.getByRole("link", { name: "Contabilidad" })).toBeInTheDocument()
    })

    it("opens the cost calculator and keeps Configuración and Cuenta in the footer", () => {
        renderPanel()
        fireEvent.click(screen.getByText("Calculadora de Costos"))
        expect(mocks.openTool).toHaveBeenCalledWith("cost-calculator")
        expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("href", "/settings")
        expect(screen.getByRole("button", { name: /Cuenta/ })).toBeInTheDocument()
    })
})
