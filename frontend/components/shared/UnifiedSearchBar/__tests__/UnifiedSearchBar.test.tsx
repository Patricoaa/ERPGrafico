import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ResultCountProvider, UnifiedSearchBar } from "@/components/shared"
import type { UnifiedChip, UnifiedSearchConfig } from "@/types/unified-search"

const config: UnifiedSearchConfig = { searchFields: [{ key: "search", label: "Folio", serverParam: "search" }] }

function chip(id: string, label: string, valueLabel: string, variant: UnifiedChip["variant"], onRemove = vi.fn()): UnifiedChip {
    return { id, label, valueLabel, variant, onRemove }
}

function renderBar(chips: UnifiedChip[], { onClearAll = vi.fn(), count }: { onClearAll?: () => Promise<void>; count?: number | null } = {}) {
    const bar = (
        <UnifiedSearchBar
            config={config}
            chips={chips}
            isFiltered={chips.length > 0}
            inputValue=""
            onInputChange={vi.fn()}
            onApply={vi.fn()}
            onRemove={vi.fn()}
            onClearAll={onClearAll}
            groupBy={null}
            onGroupBySelect={vi.fn()}
            paramValues={{}}
            placeholder="Buscar notas"
        />
    )
    return render(count === undefined ? bar : <ResultCountProvider count={count}>{bar}</ResultCountProvider>)
}

describe("UnifiedSearchBar applied filters (ADR-0158 stage 1)", () => {
    it("renders no applied-filters row while nothing is active", () => {
        renderBar([], { count: 12 })
        expect(screen.queryByRole("list", { name: "Filtros aplicados" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Limpiar todo" })).toBeNull()
        expect(screen.getByRole("textbox", { name: "Buscar notas" })).toHaveAttribute("placeholder", "Buscar notas")
    })

    it("lists every chip outside the input, removable one by one", async () => {
        const user = userEvent.setup()
        const removeStatus = vi.fn()
        renderBar([
            chip("status", "Estado", "Confirmada, En producción", "filter", removeStatus),
            chip("date", "Fecha", "Este mes", "date"),
            chip("group_by", "Agrupado por", "Estado", "group"),
        ])
        const list = screen.getByRole("list", { name: "Filtros aplicados" })
        expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
            "Estado: Confirmada, En producción",
            "Fecha: Este mes",
            "Agrupado por Estado",
        ])
        // The input keeps its placeholder: chips no longer live inside it.
        expect(screen.getByRole("textbox", { name: "Buscar notas" })).toHaveAttribute("placeholder", "Buscar notas")
        await user.click(within(list).getByRole("button", { name: "Quitar Estado: Confirmada, En producción" }))
        expect(removeStatus).toHaveBeenCalledOnce()
    })

    it("clears everything with «Limpiar todo»", async () => {
        const user = userEvent.setup()
        const onClearAll = vi.fn().mockResolvedValue(undefined)
        renderBar([chip("status", "Estado", "Borrador", "filter")], { onClearAll })
        await user.click(screen.getByRole("button", { name: "Limpiar todo" }))
        expect(onClearAll).toHaveBeenCalledOnce()
    })

    it("shows the collection result count from the toolbar", () => {
        const { rerender } = renderBar([chip("status", "Estado", "Borrador", "filter")], { count: 1204 })
        expect(screen.getByText("1.204 resultados")).toBeInTheDocument()
        rerender(
            <ResultCountProvider count={null}>
                <UnifiedSearchBar config={config} chips={[chip("status", "Estado", "Borrador", "filter")]} isFiltered inputValue="" onInputChange={vi.fn()} onApply={vi.fn()} onRemove={vi.fn()} onClearAll={vi.fn()} groupBy={null} onGroupBySelect={vi.fn()} paramValues={{}} />
            </ResultCountProvider>,
        )
        expect(screen.queryByText(/resultado/)).toBeNull()
    })

    it("removes the last chip with Backspace on an empty input", async () => {
        const user = userEvent.setup()
        const removeLast = vi.fn()
        renderBar([chip("status", "Estado", "Borrador", "filter"), chip("date", "Fecha", "Hoy", "date", removeLast)])
        await user.click(screen.getByRole("textbox", { name: "Buscar notas" }))
        await user.keyboard("{Backspace}")
        expect(removeLast).toHaveBeenCalledOnce()
    })
})
