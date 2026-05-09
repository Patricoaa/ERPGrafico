import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { EntityDetailPage } from "./EntityDetailPage"

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/features/audit/components/ActivitySidebar", () => ({
    ActivitySidebar: ({ entityType, entityId }: { entityType: string; entityId: number | string }) => (
        <div data-testid="activity-sidebar" data-entity-type={entityType} data-entity-id={entityId}>
            ActivitySidebar mock
        </div>
    ),
}))

vi.mock("@/components/ui/dynamic-icon", () => ({
    DynamicIcon: ({ name }: { name: string }) => (
        <span data-testid="dynamic-icon" data-icon={name} />
    ),
}))

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultProps = {
    entityType: "sale_order" as const,
    title: "Nota de Venta",
    displayId: "NV-001",
    icon: "receipt-text",
    breadcrumb: [
        { label: "Ventas", href: "/sales" },
        { label: "Órdenes", href: "/sales/orders" },
    ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EntityDetailPage", () => {
    // ── Render básico ──────────────────────────────────────────────────────

    it("renders the page shell with data-testid", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>form content</div>
            </EntityDetailPage>
        )
        expect(screen.getByTestId("entity-detail-page")).toBeInTheDocument()
    })

    it("renders the sticky header", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByTestId("entity-detail-header")).toBeInTheDocument()
    })

    it("renders the title", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByRole("heading", { level: 1, name: "Nota de Venta" })).toBeInTheDocument()
    })

    it("renders the displayId when provided", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByText("NV-001")).toBeInTheDocument()
    })

    it("does NOT render displayId when omitted", () => {
        const props = { ...defaultProps, displayId: undefined }
        render(
            <EntityDetailPage {...props}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.queryByText("NV-001")).not.toBeInTheDocument()
    })

    it("renders the icon", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByTestId("dynamic-icon")).toHaveAttribute("data-icon", "receipt-text")
    })

    it("renders breadcrumb links", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByRole("link", { name: "Ventas" })).toHaveAttribute("href", "/sales")
        expect(screen.getByRole("link", { name: "Órdenes" })).toHaveAttribute("href", "/sales/orders")
    })

    it("renders children content", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>form content here</div>
            </EntityDetailPage>
        )
        expect(screen.getByText("form content here")).toBeInTheDocument()
    })

    // ── Sidebar ────────────────────────────────────────────────────────────

    it("shows ActivitySidebar automatically when instanceId is provided", () => {
        render(
            <EntityDetailPage {...defaultProps} instanceId={42}>
                <div>content</div>
            </EntityDetailPage>
        )
        const sidebar = screen.getByTestId("activity-sidebar")
        expect(sidebar).toBeInTheDocument()
        expect(sidebar).toHaveAttribute("data-entity-type", "sale_order")
        expect(sidebar).toHaveAttribute("data-entity-id", "42")
    })

    it("does NOT show ActivitySidebar when instanceId is absent", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.queryByTestId("activity-sidebar")).not.toBeInTheDocument()
    })

    it("renders custom sidebar when sidebar prop is provided", () => {
        render(
            <EntityDetailPage {...defaultProps} sidebar={<div data-testid="custom-sidebar">Custom</div>}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByTestId("custom-sidebar")).toBeInTheDocument()
        expect(screen.queryByTestId("activity-sidebar")).not.toBeInTheDocument()
    })

    it("suppresses sidebar when sidebar={null} even if instanceId provided", () => {
        render(
            <EntityDetailPage {...defaultProps} instanceId={1} sidebar={null}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.queryByTestId("activity-sidebar")).not.toBeInTheDocument()
    })

    // ── Footer ─────────────────────────────────────────────────────────────

    it("renders footer when footer prop is provided and not readonly", () => {
        render(
            <EntityDetailPage {...defaultProps} footer={<button>Guardar</button>}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.getByTestId("entity-detail-footer")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
    })

    it("does NOT render footer when footer prop is absent", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.queryByTestId("entity-detail-footer")).not.toBeInTheDocument()
    })

    // ── Readonly mode ──────────────────────────────────────────────────────

    it("shows the 'Solo lectura' badge when readonly is true", () => {
        render(
            <EntityDetailPage {...defaultProps} readonly>
                <div>read-only content</div>
            </EntityDetailPage>
        )
        expect(screen.getByTestId("entity-detail-readonly-badge")).toBeInTheDocument()
        expect(screen.getByText("Solo lectura")).toBeInTheDocument()
    })

    it("does NOT show the readonly badge when readonly is false (default)", () => {
        render(
            <EntityDetailPage {...defaultProps}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.queryByTestId("entity-detail-readonly-badge")).not.toBeInTheDocument()
    })

    it("hides footer even when provided if readonly is true", () => {
        render(
            <EntityDetailPage {...defaultProps} readonly footer={<button>Guardar</button>}>
                <div>content</div>
            </EntityDetailPage>
        )
        expect(screen.queryByTestId("entity-detail-footer")).not.toBeInTheDocument()
    })

    it("still renders children content in readonly mode", () => {
        render(
            <EntityDetailPage {...defaultProps} readonly>
                <dl><dt>Campo</dt><dd>Valor</dd></dl>
            </EntityDetailPage>
        )
        expect(screen.getByText("Campo")).toBeInTheDocument()
        expect(screen.getByText("Valor")).toBeInTheDocument()
    })
})
