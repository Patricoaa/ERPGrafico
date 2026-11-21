import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import React from "react"

import { VariantSelectorModal } from "../ProductGridPicker/VariantSelectorModal"

vi.mock("@/features/inventory", () => ({
    useVariants: () => ({
        isLoading: false,
        variants: [
            // SURCHARGE: la copia guardada es la de la plantilla; el cobrado es plantilla + recargo.
            { id: 11, code: "V1", name: "Variante recargo", sale_price: 840, sale_price_gross: "1000", effective_price: 1500 },
            { id: 12, code: "V2", name: "Variante propia", sale_price: 1000, sale_price_gross: "1190" },
        ],
    }),
}))

describe("VariantSelectorModal", () => {
    it("muestra el bruto resuelto (effective_price) y cae al bruto guardado sin él (ADR-0151)", () => {
        render(
            <VariantSelectorModal
                open
                onOpenChange={() => {}}
                product={{ id: 1, code: "T", name: "Plantilla", sale_price: 840 }}
                onSelect={() => {}}
            />,
        )
        expect(screen.getByText(/1\.500/)).toBeTruthy()
        expect(screen.queryByText(/1\.000/)).toBeNull()
        expect(screen.getByText(/1\.190/)).toBeTruthy()
    })
})
