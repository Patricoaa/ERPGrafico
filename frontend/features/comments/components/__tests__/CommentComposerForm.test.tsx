import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CommentComposerForm } from "../CommentComposerForm"

vi.mock("../../hooks/useMentionables", () => ({
    useMentionables: () => ({ mentionables: { users: [], teams: [] }, loading: false }),
}))

const target = { label: "contacts.contact", id: 1 }

/** El composer vive dentro del <form> de algunos drawers (ADR-0111). */
function renderInsideParentForm(onSubmit: (text: string, files: File[]) => Promise<unknown>) {
    const parentSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const { container } = render(
        // eslint-disable-next-line forms/must-use-hook -- simula el <form> del drawer que envuelve el rail
        <form onSubmit={parentSubmit}>
            <CommentComposerForm target={target} onSubmit={onSubmit} />
        </form>,
    )
    return { container, parentSubmit }
}

describe("CommentComposerForm", () => {
    it("renders no nested <form>", () => {
        const { container } = renderInsideParentForm(vi.fn(async () => {}))
        expect(container.querySelectorAll("form")).toHaveLength(1)
    })

    it("submits on Enter without submitting the parent form", async () => {
        const onSubmit = vi.fn(async () => {})
        const { parentSubmit } = renderInsideParentForm(onSubmit)
        const textarea = screen.getByLabelText("Comentario")
        fireEvent.change(textarea, { target: { value: "hola" } })
        fireEvent.keyDown(textarea, { key: "Enter" })
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("hola", []))
        expect(parentSubmit).not.toHaveBeenCalled()
    })

    it("submits on send click without submitting the parent form", async () => {
        const onSubmit = vi.fn(async () => {})
        const { parentSubmit } = renderInsideParentForm(onSubmit)
        fireEvent.change(screen.getByLabelText("Comentario"), { target: { value: "desde botón" } })
        fireEvent.click(screen.getByRole("button", { name: "Comentar" }))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("desde botón", []))
        expect(parentSubmit).not.toHaveBeenCalled()
    })

    it("does not submit an empty comment", async () => {
        const onSubmit = vi.fn(async () => {})
        renderInsideParentForm(onSubmit)
        fireEvent.click(screen.getByRole("button", { name: "Comentar" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("Escribe un comentario")
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it("sends attachment-only comments and lets the user remove a pending file", async () => {
        const onSubmit = vi.fn(async () => {})
        renderInsideParentForm(onSubmit)
        const input = screen.getByLabelText("Archivos adjuntos")
        const plano = new File(["%PDF"], "plano.pdf", { type: "application/pdf" })
        const extra = new File(["x"], "extra.pdf", { type: "application/pdf" })
        fireEvent.change(input, { target: { files: [plano, extra] } })
        fireEvent.click(await screen.findByRole("button", { name: "Quitar extra.pdf" }))
        fireEvent.click(screen.getByRole("button", { name: "Comentar" }))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("", [plano]))
    })

    it("rejects disallowed file types", async () => {
        const onSubmit = vi.fn(async () => {})
        renderInsideParentForm(onSubmit)
        fireEvent.change(screen.getByLabelText("Archivos adjuntos"), {
            target: { files: [new File(["x"], "virus.exe")] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Comentar" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("Tipo de archivo no permitido")
        expect(onSubmit).not.toHaveBeenCalled()
    })
})
