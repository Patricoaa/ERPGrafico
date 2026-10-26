import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { AlertCircle } from "lucide-react"
import { InfoBlock } from "./InfoBlock"

describe("InfoBlock", () => {
    it("renders title, text and actions, announced as a status", () => {
        render(
            <InfoBlock tone="warning" icon={AlertCircle} title="Autorización requerida" actions={<button type="button">Solicitar</button>}>
                Supera el cupo de crédito.
            </InfoBlock>
        )
        expect(screen.getByRole("status")).toHaveTextContent("Autorización requerida")
        expect(screen.getByText("Supera el cupo de crédito.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Solicitar" })).toBeInTheDocument()
    })

    it("can be an alert or a static note", () => {
        const { rerender } = render(<InfoBlock icon={AlertCircle} title="Error" live="alert" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()
        rerender(<InfoBlock icon={AlertCircle} title="Nota" live="none" />)
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
})
