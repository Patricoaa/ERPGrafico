import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CheckoutDocumentsList } from "../CheckoutDocumentsList"

const docs = [
    { id: 1, display_id: "BOL-001", dte_type: "BOLETA", total: "6000.00" },
    { id: 2, display_id: "CP-002", dte_type: "COMPROBANTE_PAGO", total: "4000.00" },
]

describe("CheckoutDocumentsList", () => {
    it("lista cada documento con su total cuando hay dos o más", () => {
        render(<CheckoutDocumentsList documents={docs} />)
        expect(screen.getByText("BOL-001")).toBeTruthy()
        expect(screen.getByText("CP-002")).toBeTruthy()
        expect(screen.getByText("$6.000")).toBeTruthy()
        expect(screen.getByText("$4.000")).toBeTruthy()
    })

    it("no renderiza nada con un documento o sin documentos", () => {
        const { container, rerender } = render(<CheckoutDocumentsList documents={[docs[0]]} />)
        expect(container.innerHTML).toBe("")
        rerender(<CheckoutDocumentsList documents={undefined} />)
        expect(container.innerHTML).toBe("")
    })
})
