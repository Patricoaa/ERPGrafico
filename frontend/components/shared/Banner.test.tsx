import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Banner } from "./Banner"

describe("Banner", () => {
    it("renders title, hint and actions, announced as a status", () => {
        render(
            <Banner
                tone="warning"
                icon={AlertCircle}
                title="Autorización requerida"
                value="$ 12.000"
                actions={<Button type="button">Solicitar</Button>}
            >
                Supera el cupo de crédito.
            </Banner>
        )
        expect(screen.getByRole("status")).toHaveTextContent("Autorización requerida")
        expect(screen.getByRole("status")).toHaveTextContent("$ 12.000")
        expect(screen.getByText("Supera el cupo de crédito.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Solicitar" })).toBeInTheDocument()
    })

    it("is a flat band: tinted background, no radius and no border", () => {
        render(<Banner tone="warning">Datos guardados</Banner>)
        const band = screen.getByRole("status")
        expect(band).toHaveClass("bg-warning/5", "border-0", "rounded-none")
        expect(band.className).not.toMatch(/rounded-(sm|md|lg|xl)/)
        expect(band.className).not.toMatch(/(^|\s)border(\s|$)/)
    })

    it("tints the icon and keeps the text on neutral tokens", () => {
        render(<Banner tone="destructive" title="Error bloqueante" />)
        const band = screen.getByRole("alert")
        expect(band).toHaveClass("bg-destructive/5")
        expect(band.querySelector("svg")).toHaveClass("text-destructive")
        expect(screen.getByText("Error bloqueante")).not.toHaveClass("text-destructive")
    })

    it("maps the tone to the live region and can opt out", () => {
        const { rerender } = render(<Banner tone="info" title="Nota" />)
        expect(screen.getByRole("status")).toBeInTheDocument()

        rerender(<Banner tone="destructive" title="Error" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()

        rerender(<Banner tone="info" title="Nota" live="alert" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()

        rerender(<Banner tone="warning" title="Nota" live="none" />)
        expect(screen.queryByRole("status")).not.toBeInTheDocument()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("cancels the host gutter for a full-bleed band", () => {
        const { rerender } = render(<Banner bleed="none">Aviso</Banner>)
        expect(screen.getByRole("status")).toHaveClass("px-4")

        rerender(<Banner bleed="lg">Aviso</Banner>)
        const band = screen.getByRole("status")
        expect(band).toHaveClass("-mx-6", "px-6", "w-[calc(100%+3rem)]")
        expect(band).not.toHaveClass("px-4")
        expect(band).not.toHaveClass("w-full")
    })

    it("dismisses with an accessible close button", async () => {
        const onDismiss = vi.fn()
        render(<Banner onDismiss={onDismiss}>Aviso</Banner>)
        await userEvent.click(screen.getByRole("button", { name: "Descartar aviso" }))
        expect(onDismiss).toHaveBeenCalledOnce()
    })
})
