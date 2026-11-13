import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Info } from "lucide-react"
import { Section } from "./index"

describe("Section", () => {
    it("renderiza título con icono, conteo, descripción y acciones; la sección queda nombrada por su título", () => {
        render(
            <Section title="Datos" icon={Info} count="2 de 5" description="Resumen" actions={<Section.Action text="Ver todo" onClick={() => {}} />}>
                <Section.Row title="Fila" />
            </Section>,
        )
        expect(screen.getByRole("region", { name: "Datos" })).toBeInTheDocument()
        expect(screen.getByText("2 de 5")).toBeInTheDocument()
        expect(screen.getByText("Resumen")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Ver todo" })).toBeInTheDocument()
    })

    it("funciona con un solo hijo (una nota)", () => {
        render(<Section><Section.Note tone="success">Todo en orden.</Section.Note></Section>)
        expect(screen.getByRole("list")).toBeInTheDocument()
        expect(screen.getAllByRole("listitem")).toHaveLength(1)
    })

    it("filas stat y total muestran etiqueta y valor", () => {
        render(
            <Section>
                <Section.Row variant="stat" title="Subtotal" value="$100" />
                <Section.Row variant="total" title="Total" value="$119" />
            </Section>,
        )
        expect(screen.getByText("Subtotal")).toBeInTheDocument()
        expect(screen.getByText("$119")).toHaveClass("font-black")
    })

    it("el detalle desplegable lo controla quien usa la fila", async () => {
        const onToggle = vi.fn()
        const { rerender } = render(
            <Section><Section.Row title="Pendiente" expand={{ label: "Ver 2", expanded: false, onToggle, content: <p>Detalle</p> }} /></Section>,
        )
        expect(screen.queryByText("Detalle")).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Ver 2" }))
        expect(onToggle).toHaveBeenCalledOnce()
        rerender(<Section><Section.Row title="Pendiente" expand={{ label: "Ver 2", expanded: true, onToggle, content: <p>Detalle</p> }} /></Section>)
        expect(screen.getByText("Detalle")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Ver 2" })).toHaveAttribute("aria-expanded", "true")
    })

    it("fila pulsable expone aria-pressed y responde a teclado", async () => {
        const onClick = vi.fn()
        render(<Section><Section.Row title="Modo oscuro" onClick={onClick} pressed /></Section>)
        const row = screen.getByRole("button", { name: /Modo oscuro/ })
        expect(row).toHaveAttribute("aria-pressed", "true")
        row.focus()
        await userEvent.keyboard("{Enter}")
        expect(onClick).toHaveBeenCalledOnce()
    })

    it("aloja un control con lógica propia", () => {
        render(<Section><Section.Row title="Moneda" control={<select aria-label="Moneda"><option>CLP</option></select>} /></Section>)
        expect(screen.getByRole("combobox", { name: "Moneda" })).toBeInTheDocument()
    })

    it("resuelve vacío y error con reintento", async () => {
        const onRetry = vi.fn()
        const { rerender } = render(<Section title="X" isEmpty emptyTitle="Sin datos aquí" />)
        expect(screen.getByText("Sin datos aquí")).toBeInTheDocument()
        rerender(<Section title="X" isError onRetry={onRetry} />)
        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(onRetry).toHaveBeenCalledOnce()
    })

    it("Section.Action con href es un enlace", () => {
        render(<Section.Action text="Ir" href="/a" />)
        expect(screen.getByRole("link", { name: "Ir" })).toHaveAttribute("href", "/a")
    })
})
