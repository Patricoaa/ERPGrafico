import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"

import { PaymentMethodSelector, type PaymentData } from "../PaymentMethodSelector"

vi.mock("@/hooks/useAllowedPaymentMethods", () => ({
    useAllowedPaymentMethods: () => ({
        methods: [
            {
                id: 1, name: "Efectivo", method_type: "CASH", allow_for_sales: true, allow_for_purchases: true,
                is_active: true, treasury_account: 5, treasury_account_name: "Caja", is_terminal_integration: false,
                linked_terminal_device: null,
            },
        ],
        loading: false,
    }),
}))
vi.mock("../../hooks/useMasterData", () => ({ useBanks: () => ({ banks: [] }) }))

const base: PaymentData = { method: null, amount: 0, treasuryAccountId: null, paymentMethodId: null }

const renderSelector = (paymentData: PaymentData) =>
    render(
        <PaymentMethodSelector operation="sales" total={10000} paymentData={paymentData} onPaymentDataChange={vi.fn()} />,
    )

/** #231: un monto 0 confirmado equivale a todo el total como crédito asignado. */
describe("PaymentMethodSelector — crédito asignado con monto 0", () => {
    it("muestra el crédito asignado por el total cuando se confirma un monto 0", () => {
        renderSelector({ ...base, method: "CASH", amount: 0 })
        expect(screen.getByText("Crédito Asignado")).toBeInTheDocument()
    })

    it("sigue mostrando el crédito por el saldo con un pago parcial", () => {
        renderSelector({ ...base, method: "CASH", amount: 1 })
        expect(screen.getByText("Crédito Asignado")).toBeInTheDocument()
    })

    it("no muestra crédito si todavía no se eligió método", () => {
        renderSelector(base)
        expect(screen.queryByText("Crédito Asignado")).not.toBeInTheDocument()
    })

    it("no muestra crédito cuando el pago cubre el total", () => {
        renderSelector({ ...base, method: "CASH", amount: 10000 })
        expect(screen.queryByText("Crédito Asignado")).not.toBeInTheDocument()
    })
})
