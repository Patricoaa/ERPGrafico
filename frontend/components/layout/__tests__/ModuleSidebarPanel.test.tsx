import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"

import { ModuleSidebarPanel } from "../ModuleSidebarPanel"

const mocks = vi.hoisted(() => ({
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
    useGlobalModals: () => ({ tabs: [] }),
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
        mocks.pathname = "/sales/docs"
    })

    it("shows the company identity in the header, with the name as fallback when there is no logo", () => {
        renderPanel()
        expect(screen.getByText("ACME S.A.")).toBeInTheDocument()
        expect(screen.queryByText("AC")).toBeNull()
        expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument()
    })

    it("deja en utilidades solo el Punto de Venta: Buscar y Bandeja viven en el riel", () => {
        renderPanel()
        expect(screen.queryByText("Buscar")).toBeNull()
        expect(screen.queryByText("Bandeja de entrada")).toBeNull()
        const pos = screen.getByText("Punto de Venta")
        expect(pos.compareDocumentPosition(screen.getByRole("button", { name: "Contabilidad" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it("pinta la fila de herramientas móvil arriba del Punto de Venta", () => {
        renderPanel({ toolRow: <div>fila-herramientas</div> })
        const row = screen.getByText("fila-herramientas")
        expect(row.compareDocumentPosition(screen.getByText("Punto de Venta")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it("lists every module as a first-level accordion with no direct link", () => {
        renderPanel()
        const nav = screen.getByRole("navigation", { name: "Módulos y vistas" })
        const moduleLabels = ["Contabilidad", "Ventas", "Contactos", "Inventario", "Producción", "Tesorería", "Compras", "Finanzas", "RRHH", "Seguridad"]
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

    it("ya no lista la calculadora (vive en el riel) y mantiene Configuración y Cuenta en el pie", () => {
        renderPanel()
        expect(screen.queryByText("Calculadora de Costos")).toBeNull()
        expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("href", "/settings")
        const cuenta = screen.getByRole("button", { name: /Cuenta/ })
        expect(cuenta).toBeInTheDocument()
        expect(cuenta.querySelector(".lucide-chevron-right")).toBeNull()
    })
})
