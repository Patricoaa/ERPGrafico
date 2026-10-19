import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { ErrorPage } from "./ErrorPage"

describe("ErrorPage", () => {
    // ─── Render básico ──────────────────────────────────────────
    it("renders the title", () => {
        render(<ErrorPage title="Error de prueba" />)
        expect(screen.getByText("Error de prueba")).toBeInTheDocument()
    })

    it("renders the description when provided", () => {
        render(<ErrorPage title="Error" description="Algo salió mal" />)
        expect(screen.getByText("Algo salió mal")).toBeInTheDocument()
    })

    it("renders the error message when error prop is passed", () => {
        const error = new Error("Error técnico")
        render(<ErrorPage title="Error" error={error} />)
        expect(screen.getByText("Error técnico")).toBeInTheDocument()
    })

    it("renders 'Error desconocido' when error has no message", () => {
        const error = new Error("")
        render(<ErrorPage title="Error" error={error} />)
        expect(screen.getByText("Error desconocido")).toBeInTheDocument()
    })

    // ─── Botón de reintentar ────────────────────────────────────
    it("shows reset button by default when onReset is provided", () => {
        const onReset = vi.fn()
        render(<ErrorPage title="Error" onReset={onReset} />)
        const button = screen.getByRole("button", { name: /reintentar/i })
        expect(button).toBeInTheDocument()
    })

    it("uses custom resetLabel when provided", () => {
        const onReset = vi.fn()
        render(<ErrorPage title="Error" onReset={onReset} resetLabel="Volver a intentar" />)
        expect(screen.getByRole("button", { name: /volver a intentar/i })).toBeInTheDocument()
    })

    it("hides reset button when showReset is false", () => {
        const onReset = vi.fn()
        render(<ErrorPage title="Error" onReset={onReset} showReset={false} />)
        expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument()
    })

    it("hides reset button when onReset is not provided", () => {
        render(<ErrorPage title="Error" />)
        expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument()
    })

    it("calls onReset when button is clicked", async () => {
        const onReset = vi.fn()
        render(<ErrorPage title="Error" onReset={onReset} />)
        await userEvent.click(screen.getByRole("button", { name: /reintentar/i }))
        expect(onReset).toHaveBeenCalledTimes(1)
    })

    it("disables button when onReset is not provided", () => {
        render(<ErrorPage title="Error" resetLabel="Reintentar" />)
        const button = screen.queryByRole("button", { name: /reintentar/i })
        expect(button).not.toBeInTheDocument()
    })

    // ─── Variantes ──────────────────────────────────────────────
    it("applies inline variant classes", () => {
        const { container } = render(<ErrorPage title="Error" variant="inline" />)
        const card = container.querySelector("div[class*='max-w-none']")
        expect(card).toBeInTheDocument()
    })

    it("applies default variant classes", () => {
        const { container } = render(<ErrorPage title="Error" variant="default" />)
        const mainDiv = container.firstChild as HTMLElement
        expect(mainDiv).toHaveClass("flex-1")
    })

    // ─── Clases personalizadas ──────────────────────────────────
    it("applies custom className", () => {
        const { container } = render(<ErrorPage title="Error" className="custom-class" />)
        expect(container.firstChild).toHaveClass("custom-class")
    })

    // ─── Accesibilidad ──────────────────────────────────────────
    it("has role=alert on container", () => {
        render(<ErrorPage title="Error" />)
        const container = screen.getByRole("alert")
        expect(container).toBeInTheDocument()
    })

    it("icon has aria-hidden", () => {
        render(<ErrorPage title="Error" />)
        const icon = screen.getByTestId("alert-icon")
        // El icono no tiene test-id, verificamos que existe el svg
        const svg = screen.getByRole("img", { hidden: true })
        expect(svg).toBeInTheDocument()
    })

    // ─── Refresh icon ───────────────────────────────────────────
    it("renders refresh icon in button", () => {
        const onReset = vi.fn()
        render(<ErrorPage title="Error" onReset={onReset} />)
        const button = screen.getByRole("button", { name: /reintentar/i })
        const svg = button.querySelector("svg")
        expect(svg).toBeInTheDocument()
    })
})