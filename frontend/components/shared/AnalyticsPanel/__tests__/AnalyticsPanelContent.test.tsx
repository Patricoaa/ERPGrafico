import { fireEvent, render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { AnalyticsPanelContent } from "../AnalyticsPanel"
import type { AnalyticsTab } from "../types"

const tab = (value: string, label: string, badge?: number): AnalyticsTab => ({
    value,
    label,
    badge,
    columns: [{ id: `${value}-c`, sections: [{ id: `${value}-s`, content: { type: "custom", render: <p>{`contenido-${value}`}</p> } }] }],
})

const tabs = [tab("uno", "Uno"), tab("dos", "Dos", 4)]

describe("AnalyticsPanelContent", () => {
    it("renders tabs in a RailNav and switches content on click", () => {
        render(<AnalyticsPanelContent entityName="Ventas" tabs={tabs} />)
        expect(screen.getByRole("navigation", { name: "Secciones de análisis de Ventas" })).toBeInTheDocument()
        expect(screen.getByText("contenido-uno")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Dos" }))
        expect(screen.getByText("contenido-dos")).toBeInTheDocument()
        expect(screen.queryByText("contenido-uno")).not.toBeInTheDocument()
    })

    it("renders the granularity control only when value and handler are both provided", () => {
        const { rerender } = render(
            <AnalyticsPanelContent entityName="Ventas" tabs={tabs} granularity="month" onGranularityChange={vi.fn()} />,
        )
        // rail slot (sm+) and compact copy above the content (< sm)
        expect(screen.getAllByText("Agrupación")).toHaveLength(2)
        rerender(<AnalyticsPanelContent entityName="Ventas" tabs={tabs} granularity="month" />)
        expect(screen.queryByText("Agrupación")).not.toBeInTheDocument()
    })
})
