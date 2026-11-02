import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FormSelectionGroup } from "./FormSelectionGroup"

describe("FormSelectionGroup", () => {
    it("supports accessible single selection and arrow-key navigation", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(
            <FormSelectionGroup
                mode="single"
                label="Modo de producción"
                icon={<span aria-hidden="true">⚙</span>}
                value="simple"
                onChange={onChange}
                items={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Avanzado" }]}
            />,
        )

        const group = screen.getByRole("radiogroup", { name: "Modo de producción" })
        const simple = within(group).getByRole("radio", { name: "Simple" })
        const advanced = within(group).getByRole("radio", { name: "Avanzado" })
        expect(simple).toHaveAttribute("aria-checked", "true")
        expect(simple).toHaveAttribute("tabindex", "0")
        expect(advanced).toHaveAttribute("tabindex", "-1")

        simple.focus()
        await user.keyboard("{ArrowDown}")
        expect(advanced).toHaveFocus()
        expect(onChange).toHaveBeenLastCalledWith("advanced")
    })

    it("supports multiple selection, select-all, descriptions and a footer", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        const { rerender } = render(
            <FormSelectionGroup
                mode="multiple"
                label="Cuentas permitidas"
                icon={<span aria-hidden="true">▤</span>}
                value={[1]}
                onChange={onChange}
                selectAll
                selectAllLabel="Seleccionar cuentas"
                items={[
                    { value: 1, label: "Caja", eyebrow: "Efectivo", description: "Cuenta operativa" },
                    { value: 2, label: "Banco", description: "Transferencias" },
                ]}
                footer={<span>Total seleccionado</span>}
            />,
        )

        expect(screen.getByRole("heading", { name: "Cuentas permitidas" })).toBeInTheDocument()
        expect(document.querySelector("fieldset")).toBeNull()
        const group = screen.getByRole("group", { name: "Cuentas permitidas" })
        expect(within(group).getByRole("checkbox", { name: "Caja" })).toHaveAttribute("aria-checked", "true")
        await user.click(within(group).getByRole("checkbox", { name: "Banco" }))
        expect(onChange).toHaveBeenLastCalledWith([1, 2])

        rerender(
            <FormSelectionGroup
                mode="multiple"
                label="Cuentas permitidas"
                icon={<span aria-hidden="true">▤</span>}
                value={[1]}
                onChange={onChange}
                selectAll
                selectAllLabel="Seleccionar cuentas"
                items={[
                    { value: 1, label: "Caja", eyebrow: "Efectivo", description: "Cuenta operativa" },
                    { value: 2, label: "Banco", description: "Transferencias" },
                ]}
                footer={<span>Total seleccionado</span>}
            />,
        )
        await user.click(screen.getByRole("checkbox", { name: "Seleccionar cuentas" }))
        expect(onChange).toHaveBeenLastCalledWith([1, 2])
        expect(screen.getByText("Total seleccionado")).toBeInTheDocument()
    })

    it("renders loading and empty states", () => {
        const { rerender } = render(
            <FormSelectionGroup mode="multiple" label="Permisos" icon={<span />} value={[]} onChange={vi.fn()} items={[]} isLoading />,
        )
        expect(screen.getByRole("status")).toHaveTextContent("Cargando opciones")

        rerender(<FormSelectionGroup mode="multiple" label="Permisos" icon={<span />} value={[]} onChange={vi.fn()} items={[]} />)
        expect(screen.getByRole("status")).toHaveTextContent("No hay opciones disponibles")
    })
})
