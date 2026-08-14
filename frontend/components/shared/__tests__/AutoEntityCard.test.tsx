import { describe, it, expect } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createEntityFields } from "../entity-fields"
import { AutoEntityCard } from "../AutoEntityCard"

interface CardEntity {
    id: number
    code: string
    partner_name: string
    dte_type_display: string
    total: number
}

const cardFields = createEntityFields<CardEntity>()({
    code: { key: "code", type: "code", label: "Folio" },
    partner: { key: "partner_name", type: "secondary", label: "Cliente" },
    dte: { key: "dte_type_display", type: "secondary", label: "Tipo DTE" },
    total: { key: "total", type: "currency", label: "Total" },
})

const entity: CardEntity = {
    id: 1,
    code: "F33-1",
    partner_name: "ACME S.A.",
    dte_type_display: "Factura",
    total: 15000,
}

describe("AutoEntityCard center composition", () => {
    it("renders detail (secondary) fields alongside hubStatusRenderer content", () => {
        const html = renderToStaticMarkup(
            <AutoEntityCard
                data={entity}
                fields={cardFields}
                variant="full"
                hubStatusRenderer={() => <span data-testid="hub-status">HUB</span>}
            />,
        )
        expect(html).toContain("ACME S.A.")
        expect(html).toContain("Factura")
        expect(html).toContain("HUB")
    })

    it("renders detail (secondary) fields in the center when no hubStatusRenderer is present", () => {
        const html = renderToStaticMarkup(
            <AutoEntityCard data={entity} fields={cardFields} variant="full" />,
        )
        expect(html).toContain("ACME S.A.")
        expect(html).toContain("Factura")
    })
})
