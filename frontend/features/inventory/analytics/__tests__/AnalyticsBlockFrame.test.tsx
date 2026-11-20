import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AnalyticsBlockFrame } from "../AnalyticsBlockFrame"

const BASE = {
    isLoading: false,
    isError: false,
    errorMessage: "No se pudo cargar.",
    isEmpty: false,
    emptyMessage: "Sin datos en el periodo",
    skeleton: <div>esqueleto</div>,
}

describe("AnalyticsBlockFrame", () => {
    it("muestra el skeleton mientras carga y no los datos", () => {
        const { container } = render(
            <AnalyticsBlockFrame {...BASE} isLoading><div>datos</div></AnalyticsBlockFrame>,
        )
        expect(container.querySelector("[data-skeleton-shell]")).not.toBeNull()
        expect(screen.getByText("esqueleto")).toBeInTheDocument()
        expect(screen.queryByText("datos")).not.toBeInTheDocument()
    })

    it("muestra el error con role alert", () => {
        render(<AnalyticsBlockFrame {...BASE} isError><div>datos</div></AnalyticsBlockFrame>)
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar.")
        expect(screen.queryByText("datos")).not.toBeInTheDocument()
    })

    it("muestra el mensaje vacío", () => {
        render(<AnalyticsBlockFrame {...BASE} isEmpty><div>datos</div></AnalyticsBlockFrame>)
        expect(screen.getByText("Sin datos en el periodo")).toBeInTheDocument()
        expect(screen.queryByText("datos")).not.toBeInTheDocument()
    })

    it("muestra los hijos cuando hay datos", () => {
        const { container } = render(<AnalyticsBlockFrame {...BASE}><div>datos</div></AnalyticsBlockFrame>)
        expect(screen.getByText("datos")).toBeInTheDocument()
        expect(container.querySelector("[data-skeleton-shell]")).toBeNull()
    })

    it("la carga tiene prioridad sobre el error", () => {
        const { container } = render(
            <AnalyticsBlockFrame {...BASE} isLoading isError><div>datos</div></AnalyticsBlockFrame>,
        )
        expect(container.querySelector("[data-skeleton-shell]")).not.toBeNull()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
})
