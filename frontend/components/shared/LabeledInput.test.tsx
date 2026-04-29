import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { LabeledInput } from "./LabeledInput"

describe("LabeledInput", () => {
    // ─── Render básico ──────────────────────────────────────────
    it("renders the label text in the legend", () => {
        render(<LabeledInput label="Nombre" />)
        expect(screen.getByText("Nombre")).toBeInTheDocument()
    })

    it("renders an input by default (as='input')", () => {
        render(<LabeledInput label="Campo" />)
        expect(screen.getByRole("textbox")).toBeInTheDocument()
    })

    it("renders a textarea when as='textarea'", () => {
        render(<LabeledInput label="Obs" as="textarea" />)
        expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA")
    })

    // ─── Required asterisk ──────────────────────────────────────
    it("shows asterisk when required is true", () => {
        render(<LabeledInput label="RUT" required />)
        expect(screen.getByText("*")).toBeInTheDocument()
    })

    it("does NOT show asterisk when required is false/omitted", () => {
        render(<LabeledInput label="Teléfono" />)
        expect(screen.queryByText("*")).not.toBeInTheDocument()
    })

    // ─── Error state ────────────────────────────────────────────
    it("displays the error message when error prop is passed", () => {
        render(<LabeledInput label="Email" error="Email inválido" />)
        expect(screen.getByRole("alert")).toHaveTextContent("Email inválido")
    })

    it("sets data-error on the fieldset when error is present", () => {
        const { container } = render(<LabeledInput label="X" error="err" />)
        const fieldset = container.querySelector("fieldset")
        expect(fieldset).toHaveAttribute("data-error", "true")
    })

    it("does NOT show error message when error is undefined", () => {
        render(<LabeledInput label="Campo" />)
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    // ─── Hint ────────────────────────────────────────────────────
    it("shows hint text when no error is present", () => {
        render(<LabeledInput label="Campo" hint="Ej: 12.345.678-9" />)
        expect(screen.getByText("Ej: 12.345.678-9")).toBeInTheDocument()
    })

    it("hides hint when both hint and error are present", () => {
        render(<LabeledInput label="Campo" hint="pista" error="error!" />)
        expect(screen.queryByText("pista")).not.toBeInTheDocument()
        expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // ─── Disabled state ─────────────────────────────────────────
    it("disables the input when disabled prop is true", () => {
        render(<LabeledInput label="Campo" disabled />)
        expect(screen.getByRole("textbox")).toBeDisabled()
    })

    it("sets data-disabled on the fieldset when disabled", () => {
        const { container } = render(<LabeledInput label="X" disabled />)
        const fieldset = container.querySelector("fieldset")
        expect(fieldset).toHaveAttribute("data-disabled", "true")
    })

    // ─── forwardRef ─────────────────────────────────────────────
    it("forwards ref to the input element", () => {
        const ref = vi.fn()
        render(<LabeledInput label="Campo" ref={ref} />)
        expect(ref).toHaveBeenCalled()
    })

    // ─── User interaction ────────────────────────────────────────
    it("calls onChange when typing", async () => {
        const onChange = vi.fn()
        render(<LabeledInput label="Nombre" onChange={onChange} />)
        await userEvent.type(screen.getByRole("textbox"), "Hola")
        expect(onChange).toHaveBeenCalled()
    })

    // ─── Textarea rows ───────────────────────────────────────────
    it("passes rows to textarea", () => {
        render(<LabeledInput label="Obs" as="textarea" rows={5} />)
        expect(screen.getByRole("textbox")).toHaveAttribute("rows", "5")
    })

    // ─── containerClassName ──────────────────────────────────────
    it("applies containerClassName to the wrapper div", () => {
        const { container } = render(
            <LabeledInput label="X" containerClassName="custom-class" />
        )
        expect(container.firstChild).toHaveClass("custom-class")
    })
})
