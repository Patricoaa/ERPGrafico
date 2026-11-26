import { describe, expect, it } from "vitest"
import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { Collection, defineEntity, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import type { FacetCounts, FacetViews } from "@/lib/facets"

interface Note {
    id: number
    number: string
    status: string
}

const noteEntity = defineEntity<Note>()((f) => ({
    title: "Notas",
    fields: {
        number: f.code("number", { label: "Folio" }),
        status: f.text("status", { label: "Estado" }),
    },
    query: {
        filters: {
            status: {
                field: "status",
                control: "multi",
                counts: true,
                options: [
                    { value: "DRAFT", label: "Borrador" },
                    { value: "CONFIRMED", label: "Confirmada" },
                    { value: "CANCELLED", label: "Anulada" },
                ],
            },
        },
    },
}))
const noteViews = noteEntity.views({ table: { columns: ["number", "status"] } })

const rows: Note[] = [
    { id: 1, number: "NV-1", status: "DRAFT" },
    { id: 2, number: "NV-2", status: "DRAFT" },
    { id: 3, number: "NV-3", status: "CONFIRMED" },
    { id: 4, number: "NV-4", status: "CANCELLED" },
]

/** Stands in for `facets/`: option counts and each view counted with its own params only. */
function fakeFacets(views: FacetViews): FacetCounts {
    const matching = (status?: string) => rows.filter((r) => !status || status.split(",").includes(r.status)).length
    return {
        fields: { status: { DRAFT: 2, CONFIRMED: 1, CANCELLED: 1 } },
        views: Object.fromEntries(Object.entries(views).map(([id, params]) => [id, matching(params.status)])),
    }
}

function Screen() {
    const query = useCollectionQuery(noteEntity)
    const facets = React.useMemo(() => fakeFacets(query.facetViews), [query.facetViews])
    const collection = useEntityCollection(noteEntity, { rows, rowCount: rows.length }, { pagination: { mode: "none" }, sorting: query.sorting })
    return (
        <Collection.Root collection={collection} query={{ ...query, facets }} label="Notas">
            <Collection.Toolbar />
            <Collection.View table={noteViews.table} />
        </Collection.Root>
    )
}

describe("«Aplicar · N resultados» (ADR-0158 §5)", () => {
    it("counts the unapplied multi-select choice and drops the number once applied", async () => {
        const user = userEvent.setup()
        render(
            <NuqsTestingAdapter hasMemory>
                <Screen />
            </NuqsTestingAdapter>,
        )
        await user.click(within(screen.getByRole("toolbar", { name: "Herramientas de Notas" })).getByRole("button", { name: "Filtros" }))
        expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled()

        await user.click(screen.getByRole("checkbox", { name: /Borrador/ }))
        expect(await screen.findByRole("button", { name: "Aplicar · 2 resultados" })).toBeEnabled()

        await user.click(screen.getByRole("checkbox", { name: /Confirmada/ }))
        expect(await screen.findByRole("button", { name: "Aplicar · 3 resultados" })).toBeEnabled()

        await user.click(screen.getByRole("button", { name: "Aplicar · 3 resultados" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled())
    })
})
