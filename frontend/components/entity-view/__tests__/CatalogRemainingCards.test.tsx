import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Collection, EntityViewProvider, useEntityCollection } from "@/components/entity-view"
import { attributeEntity, attributeViews } from "@/features/inventory/entity-view/attribute.entity"
import { paymentMethodEntity, paymentMethodViews } from "@/features/treasury/entity-view/paymentMethod.entity"
import { bankEntity, bankViews, type BankRow } from "@/features/treasury/entity-view/bank.entity"
import { bankCheckingAccountEntity, bankCheckingAccountViews } from "@/features/treasury/entity-view/bankCheckingAccount.entity"
import { bankCreditCardEntity, bankCreditCardViews } from "@/features/treasury/entity-view/bankCreditCard.entity"
import { terminalProviderEntity, terminalProviderViews } from "@/features/treasury/entity-view/terminalProvider.entity"
import { posTerminalEntity, posTerminalViews } from "@/features/sales/entity-view/posTerminal.entity"
import { partnerEntity, partnerViews } from "@/features/settings/entity-view/partner.entity"
import type { Attribute } from "@/features/inventory/hooks/useAttributes"
import type { BankOverviewData } from "@/features/treasury/hooks/useBankOverview"
import type { PaymentMethod, PaymentTerminalProvider, Terminal } from "@/features/treasury/types"
import type { Partner } from "@/features/contacts"

function Provider({ children }: { children: React.ReactNode }) {
    return <EntityViewProvider opener={{ open: vi.fn(), labelOf: () => undefined }}>{children}</EntityViewProvider>
}

function cards(label: string) {
    return within(screen.getByRole("list", { name: label })).getAllByRole("listitem")
}

const ATTRIBUTES: Attribute[] = [
    {
        id: 1,
        name: "Color",
        code: "ATR-01",
        value_type: "text",
        is_required: true,
        is_active: true,
        values: [{ id: 1, attribute: 1, value: "Rojo", code: "ROJO", extra_price: 0 }],
    },
    {
        id: 2,
        name: "Gramaje",
        code: "ATR-02",
        value_type: "number",
        is_required: false,
        is_active: false,
        values: [],
    },
]

const PAYMENT_METHODS: PaymentMethod[] = [
    {
        id: 1,
        name: "Débito empresa",
        method_type: "DEBIT_CARD",
        method_type_display: "Tarjeta Débito Empresa",
        treasury_account: 1,
        treasury_account_name: "Caja Principal",
        settlement_account: null,
        is_active: true,
        allow_for_sales: true,
        allow_for_purchases: false,
        is_terminal_integration: false,
        linked_terminal_device: null,
    },
    {
        id: 2,
        name: "Cheques antiguos",
        method_type: "CHECK",
        method_type_display: "Cheque",
        treasury_account: 2,
        treasury_account_name: "Caja antigua",
        settlement_account: null,
        is_active: false,
        allow_for_sales: true,
        allow_for_purchases: true,
        is_terminal_integration: false,
        linked_terminal_device: null,
    },
]

const BANK_ROWS: BankRow[] = [
    {
        id: 1,
        name: "Banco Estado",
        code: "BE",
        is_active: true,
        summary: {
            total_accounts: 2,
            card_count: 0,
            card_debt: 0,
            portfolio_checks: 0,
            issued_checks: 0,
            active_loan_count: 0,
            total_loan_debt: 0,
        },
    },
    {
        id: 2,
        name: "Banco antiguo",
        code: "OLD",
        is_active: false,
        summary: null,
    },
]

const CHECKING_ACCOUNTS: BankOverviewData["accounts"] = [
    {
        id: 1,
        name: "Cuenta Corriente Principal",
        code: "CC-01",
        account_number: "12345678",
        card_number: null,
        account_type: "CHECKING",
        account_type_display: "Cuenta Corriente",
        current_balance: 100000,
        currency: "CLP",
        credit_limit: null,
        credit_line_credit_limit: 50000,
    },
]

const CREDIT_CARDS: BankOverviewData["accounts"] = [
    {
        id: 2,
        name: "Visa Signature",
        code: null,
        account_number: null,
        card_number: "4111 1111 1111 1234",
        account_type: "CREDIT_CARD",
        account_type_display: "Tarjeta de Crédito",
        current_balance: 100000,
        currency: "CLP",
        credit_limit: 500000,
        credit_line_credit_limit: null,
    },
]

const TERMINALS: Terminal[] = [
    {
        id: 1,
        name: "Caja 1",
        code: "POS-01",
        location: "Sucursal Centro",
        is_active: true,
        allowed_payment_methods: [PAYMENT_METHODS[0], PAYMENT_METHODS[1]],
        payment_terminal_device: 1,
        payment_terminal_device_name: "MPOS-01",
    },
    {
        id: 2,
        name: "Caja antigua",
        code: "POS-00",
        location: "Bodega",
        is_active: false,
        allowed_payment_methods: [],
    },
]

const TERMINAL_PROVIDERS: PaymentTerminalProvider[] = [
    {
        id: 1,
        name: "Transbank",
        provider_type: "TRANSBANK",
        supplier: 1,
        supplier_name: "Transbank Chile",
        commission_expense_account: 1,
        commission_expense_account_name: "Comisión",
        commission_iva_account: 2,
        commission_iva_account_name: "IVA",
        receivable_account: 3,
        receivable_account_name: "Caja Recaudación",
        bank_treasury_account: null,
        default_deposit_account: null,
        commission_product: null,
        is_active: true,
    },
    {
        id: 2,
        name: "Proveedor antiguo",
        provider_type: "MANUAL",
        supplier: 2,
        supplier_name: "Contacto antiguo",
        commission_expense_account: 1,
        commission_iva_account: 2,
        receivable_account: 3,
        receivable_account_name: "Caja antigua",
        bank_treasury_account: null,
        default_deposit_account: null,
        commission_product: null,
        is_active: false,
    },
]

const PARTNERS: Partner[] = [
    {
        id: 1,
        name: "Ana Socio",
        tax_id: "12345678-9",
        partner_equity_percentage: "25.00",
        partner_total_contributions: "1000000",
        partner_total_paid_in: "800000",
        partner_pending_capital: "200000",
        partner_excess_capital: "0",
        partner_provisional_withdrawals_balance: "0",
        partner_earnings_balance: "50000",
        partner_dividends_payable_balance: "0",
        partner_net_equity: "2000000",
    },
]

function AttributeHarness() {
    const collection = useEntityCollection(attributeEntity, { rows: ATTRIBUTES })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Atributos" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={attributeViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function PaymentMethodHarness() {
    const collection = useEntityCollection(paymentMethodEntity, { rows: PAYMENT_METHODS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Medios de pago" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={paymentMethodViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function BankHarness() {
    const collection = useEntityCollection(bankEntity, { rows: BANK_ROWS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Bancos" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={bankViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function BankCheckingHarness() {
    const collection = useEntityCollection(bankCheckingAccountEntity, { rows: CHECKING_ACCOUNTS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Cuentas corrientes" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={bankCheckingAccountViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function BankCreditHarness() {
    const collection = useEntityCollection(bankCreditCardEntity, { rows: CREDIT_CARDS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Tarjetas de crédito" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={bankCreditCardViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function PosTerminalHarness() {
    const collection = useEntityCollection(posTerminalEntity, { rows: TERMINALS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Terminales POS" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={posTerminalViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function TerminalProviderHarness() {
    const collection = useEntityCollection(terminalProviderEntity, { rows: TERMINAL_PROVIDERS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Proveedores de terminal" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={terminalProviderViews.card} />
            </Collection.Root>
        </Provider>
    )
}

function PartnerHarness() {
    const collection = useEntityCollection(partnerEntity, { rows: PARTNERS })
    return (
        <Provider>
            <Collection.Root collection={collection} label="Socios" defaultView="card" actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={partnerViews.card} />
            </Collection.Root>
        </Provider>
    )
}

describe("Catalog cards — remaining entities (ADR-0097)", () => {
    it("Attribute keeps values as read-only chips and shows status only when archived", () => {
        render(<AttributeHarness />)
        const [active, archived] = cards("Atributos")
        expect(active).toHaveTextContent("ATR-01")
        expect(active).toHaveTextContent("Color")
        expect(active).toHaveTextContent("Texto")
        expect(active).toHaveTextContent("Rojo")
        expect(active).toHaveTextContent("1 valor")
        expect(within(active).queryByTitle("Añadir valor")).toBeNull()
        expect(within(active).queryByTitle("Eliminar valor")).toBeNull()
        expect(active).not.toHaveTextContent("Activo")
        expect(archived).toHaveTextContent("Archivado")
        expect(archived).toHaveTextContent("Sin valores")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("PaymentMethod uses the category as badge, the account as subtitle and one usage meta pair", () => {
        render(<PaymentMethodHarness />)
        const [active, archived] = cards("Medios de pago")
        expect(active).toHaveTextContent("Débito empresa")
        expect(active).toHaveTextContent("Tarjeta Débito Empresa")
        expect(active).toHaveTextContent("Caja Principal")
        expect(active).toHaveTextContent("Ventas")
        expect(active).not.toHaveTextContent("Compras")
        expect(active).not.toHaveTextContent("Activo")
        expect(archived).toHaveTextContent("Archivado")
        expect(archived).toHaveTextContent("Cheque")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("Bank caps the card at the accounts metric and archives without the old four-metric body", () => {
        render(<BankHarness />)
        const [active, archived] = cards("Bancos")
        expect(active).toHaveTextContent("Banco Estado")
        expect(active).toHaveTextContent("BE")
        expect(active).toHaveTextContent("Cuentas")
        expect(active).toHaveTextContent("2")
        expect(active).not.toHaveTextContent("Tarjetas")
        expect(active).not.toHaveTextContent("Cheques")
        expect(active).not.toHaveTextContent("Préstamos")
        expect(active).not.toHaveTextContent("Activo")
        expect(archived).toHaveTextContent("Archivado")
        expect(archived).not.toHaveTextContent("Cuentas")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })

    it("BankCheckingAccount shows balance as meta and available as the single footer decision metric", () => {
        render(<BankCheckingHarness />)
        const [card] = cards("Cuentas corrientes")
        expect(card).toHaveTextContent("Cuenta Corriente Principal")
        expect(card).toHaveTextContent("12345678")
        expect(card).toHaveTextContent("Saldo")
        expect(card).toHaveTextContent("100.000")
        expect(card).toHaveTextContent("Disponible")
        expect(card).toHaveTextContent("150.000")
        expect(card).not.toHaveTextContent("Línea")
    })

    it("BankCreditCard masks the PAN to the last four digits and leads with the card name", () => {
        render(<BankCreditHarness />)
        const [card] = cards("Tarjetas de crédito")
        expect(card).toHaveTextContent("Visa Signature")
        expect(card).toHaveTextContent("•••• 1234")
        expect(card).not.toHaveTextContent("4111")
        expect(card).not.toHaveTextContent("1111 1111")
        expect(card).toHaveTextContent("Cupo")
        expect(card).toHaveTextContent("500.000")
        expect(card).toHaveTextContent("Disponible")
        expect(card).toHaveTextContent("400.000")
    })

    it("POS terminal uses code, location, device and a methods count without listing methods", () => {
        render(<PosTerminalHarness />)
        const [active, inactive] = cards("Terminales POS")
        expect(active).toHaveTextContent("POS-01")
        expect(active).toHaveTextContent("Caja 1")
        expect(active).toHaveTextContent("Sucursal Centro")
        expect(active).toHaveTextContent("MPOS-01")
        expect(active).toHaveTextContent("2 métodos")
        expect(active).not.toHaveTextContent("Efectivo")
        expect(active).not.toHaveTextContent("Activo")
        expect(inactive).toHaveTextContent("Inactivo")
        expect(inactive).toHaveTextContent("Sin métodos")
        expect(inactive.firstElementChild).toHaveClass("opacity-70")
    })

    it("TerminalProvider keeps the supplier and receivable account and archives by exception", () => {
        render(<TerminalProviderHarness />)
        const [active, inactive] = cards("Proveedores de terminal")
        expect(active).toHaveTextContent("Transbank")
        expect(active).toHaveTextContent("Transbank Chile")
        expect(active).toHaveTextContent("Caja Recaudación")
        expect(active).not.toHaveTextContent("Activo")
        expect(inactive).toHaveTextContent("Inactivo")
        expect(inactive.firstElementChild).toHaveClass("opacity-70")
    })

    it("Partner caps meta at two pairs and keeps net equity as the decision metric", () => {
        render(<PartnerHarness />)
        const [card] = cards("Socios")
        expect(card).toHaveTextContent("Ana Socio")
        expect(card).toHaveTextContent("Part. %")
        expect(card).toHaveTextContent("25%")
        expect(card).toHaveTextContent("C. Suscrito")
        expect(card).toHaveTextContent("1.000.000")
        expect(card).not.toHaveTextContent("C. Enterado")
        expect(card).toHaveTextContent("Patrimonio")
        expect(card).toHaveTextContent("2.000.000")
    })
})
