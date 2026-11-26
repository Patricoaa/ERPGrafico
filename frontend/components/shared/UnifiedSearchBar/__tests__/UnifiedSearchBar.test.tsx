import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppliedFilters, UnifiedSearchBar } from "@/components/shared"
import type { UnifiedChip, UnifiedSearchConfig } from "@/types/unified-search"

const config: UnifiedSearchConfig = { searchFields: [{ key: "search", label: "Folio", serverParam: "search" }] }

function chip(id: string, label: string, valueLabel: string, variant: UnifiedChip["variant"], onRemove = vi.fn()): UnifiedChip {
    return { id, label, valueLabel, variant, onRemove }
}

describe("AppliedFilters (ADR-0158 stage 1)", () => {
    it("renders nothing while no filter is active", () => {
        const { container } = render(<AppliedFilters chips={[]} onClearAll={vi.fn()} resultCount={12} />)
        expect(container).toBeEmptyDOMElement()
    })

    it("lists every chip, removable one by one", async () => {
        const user = userEvent.setup()
        const removeStatus = vi.fn()
        render(
            <AppliedFilters
                chips={[
                    chip("status", "Estado", "Confirmada, En producción", "filter", removeStatus),
                    chip("date", "Fecha", "Este mes", "date"),
                    chip("group_by", "Agrupado por", "Estado", "group"),
                ]}
                onClearAll={vi.fn()}
            />,
        )
        const list = screen.getByRole("list", { name: "Filtros aplicados" })
        expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
            "Estado: Confirmada, En producción",
            "Fecha: Este mes",
            "Agrupado por Estado",
        ])
        await user.click(within(list).getByRole("button", { name: "Quitar Estado: Confirmada, En producción" }))
        expect(removeStatus).toHaveBeenCalledOnce()
    })

    it("clears everything with «Limpiar todo» and shows the result count", async () => {
        const user = userEvent.setup()
        const onClearAll = vi.fn().mockResolvedValue(undefined)
        render(<AppliedFilters chips={[chip("status", "Estado", "Borrador", "filter")]} onClearAll={onClearAll} resultCount={1204} />)
        expect(screen.getByText("1.204 resultados")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Limpiar todo" }))
        expect(onClearAll).toHaveBeenCalledOnce()
    })
})

describe("UnifiedSearchBar (search box of the command bar)", () => {
    function renderBar(chips: UnifiedChip[], onApply = vi.fn().mockResolvedValue(undefined), onInputChange = vi.fn()) {
        return render(<UnifiedSearchBar config={config} chips={chips} inputValue="" onInputChange={onInputChange} onApply={onApply} placeholder="Buscar notas" />)
    }

    it("removes the last applied filter with Backspace on an empty box", async () => {
        const user = userEvent.setup()
        const removeLast = vi.fn()
        renderBar([chip("status", "Estado", "Borrador", "filter"), chip("date", "Fecha", "Hoy", "date", removeLast)])
        await user.click(screen.getByRole("textbox", { name: "Buscar notas" }))
        await user.keyboard("{Backspace}")
        expect(removeLast).toHaveBeenCalledOnce()
    })

    it("has no filter menu: the command bar owns the tools", () => {
        renderBar([])
        expect(screen.queryByRole("button", { name: "Abrir filtros y búsqueda" })).toBeNull()
    })
})
