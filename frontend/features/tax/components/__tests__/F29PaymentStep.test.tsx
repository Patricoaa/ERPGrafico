import { render, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { F29PaymentStep } from "../wizard/F29PaymentStep"
import type { TaxDeclaration, TaxPaymentData } from "../../types"

const m = vi.hoisted(() => ({
    createTaxPayment: vi.fn(),
    onConfirm: null as null | ((data: TaxPaymentData) => void),
}))

vi.mock("../../hooks/useTaxMutations", () => ({
    useCreateTaxPayment: () => ({ createTaxPayment: m.createTaxPayment, isCreatingTaxPayment: false }),
    useAnnulTaxPayment: () => ({ annulTaxPayment: vi.fn(), isAnnullingTaxPayment: false }),
}))
vi.mock("@/features/treasury", () => ({
    PaymentModal: (props: { onConfirm: (data: TaxPaymentData) => void }) => {
        m.onConfirm = props.onConfirm
        return null
    },
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-12" }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const declaration = {
    id: 5,
    vat_to_pay: "1000",
    total_paid: "0",
    is_fully_paid: false,
    tax_period_display: "Octubre 2026",
    payments: [],
} as unknown as TaxDeclaration

const data = { amount: 1000, paymentMethod: "TRANSFER", treasury_account_id: 1 } as unknown as TaxPaymentData

describe("F29PaymentStep", () => {
    beforeEach(() => {
        m.createTaxPayment.mockReset()
        m.onConfirm = null
    })

    it("creates a single payment when confirmation is fired twice while in flight", async () => {
        let resolve: () => void = () => {}
        m.createTaxPayment.mockImplementation(() => new Promise<void>(r => { resolve = r }))
        const onChanged = vi.fn()
        render(<F29PaymentStep declaration={declaration} onChanged={onChanged} />)

        await act(async () => {
            m.onConfirm?.(data)
            m.onConfirm?.(data)
        })
        expect(m.createTaxPayment).toHaveBeenCalledTimes(1)

        await act(async () => { resolve() })
        expect(onChanged).toHaveBeenCalledTimes(1)
    })

    it("allows retrying after a failed payment", async () => {
        m.createTaxPayment.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined)
        render(<F29PaymentStep declaration={declaration} onChanged={vi.fn()} />)

        await act(async () => { m.onConfirm?.(data) })
        await act(async () => { m.onConfirm?.(data) })
        expect(m.createTaxPayment).toHaveBeenCalledTimes(2)
    })
})
