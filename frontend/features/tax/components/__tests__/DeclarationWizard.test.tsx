import { render, screen, act, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { DeclarationWizard } from "../DeclarationWizard"
import type { TaxPeriodDetail } from "../../types"

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

// ── hoisted mocks ──────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
    period: null as unknown,
    declarations: null as unknown,
    declarationsLoading: false,
    calculateTax: vi.fn(),
    createDeclaration: vi.fn(),
    registerDeclaration: vi.fn(),
    closePeriod: vi.fn(),
    uploadF29Document: vi.fn(),
    createTaxPayment: vi.fn(),
    annulTaxPayment: vi.fn(),
    refetch: vi.fn(),
    showApiError: vi.fn(),
}))

vi.mock("@/features/tax/hooks/useTaxMutations", () => ({
    useTaxCalculation: () => ({ calculateTax: m.calculateTax, isCalculatingTax: false }),
    useCreateDeclaration: () => ({ createDeclaration: m.createDeclaration, isCreatingDeclaration: false }),
    useRegisterDeclaration: () => ({ registerDeclaration: m.registerDeclaration, isRegisteringDeclaration: false }),
    useClosePeriod: () => ({ closePeriod: m.closePeriod, isClosingPeriod: false }),
    useUploadF29Document: () => ({ uploadF29Document: m.uploadF29Document, isUploadingF29Document: false }),
    useCreateTaxPayment: () => ({ createTaxPayment: m.createTaxPayment, isCreatingTaxPayment: false }),
    useAnnulTaxPayment: () => ({ annulTaxPayment: m.annulTaxPayment, isAnnullingTaxPayment: false }),
    useReopenPeriod: () => ({ reopenPeriod: vi.fn(), isReopeningPeriod: false }),
    useCheckPeriodClosed: () => ({ checkPeriodClosed: vi.fn(), isCheckingPeriodClosed: false }),
}))

vi.mock("@/features/tax/hooks/useTaxQueries", () => ({
    useTaxPeriod: (id: number | undefined) => ({ taxPeriod: id ? m.period : null, isLoading: false, isError: false, refetch: m.refetch }),
    useTaxPeriods: () => ({ taxPeriods: null, isLoading: false, isError: false, refetch: vi.fn() }),
    useTaxDeclarations: (params: Record<string, unknown>) => {
        const enabled = Object.keys(params).length > 0
        return { taxDeclarations: enabled ? m.declarations : null, isLoading: enabled && m.declarationsLoading, isError: false }
    },
    useF29Detail: () => ({ f29Detail: null, isLoading: false, isError: false, refetch: vi.fn() }),
    useLazyTaxDeclarations: () => ({ fetchDeclarations: vi.fn() }),
}))

vi.mock("@/features/treasury", () => ({ PaymentModal: () => null }))
vi.mock("@/lib/errors", () => ({ showApiError: m.showApiError }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@/hooks/useServerDate", () => ({
    useServerDate: () => ({ year: 2026, month: 10, dateString: "2026-11-12", serverDate: null }),
}))
vi.mock("@/hooks/useVatRate", () => ({ useVatRate: () => ({ rate: 19 }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: vi.fn(), tabs: [] as Array<{ active: boolean }> }),
}))

// ── helpers ────────────────────────────────────────────────────────────────
/** Radix blocks pointer events on <body> while a dialog is open; call the React onClick directly. */
async function press(el: Element | null) {
    if (!el) throw new Error("press() received a null element")
    const props = Object.entries(el).find(([k]) => k.startsWith("__reactProps"))?.[1] as
        | { onClick?: (e: unknown) => unknown }
        | undefined
    await act(async () => {
        if (props?.onClick) {
            await props.onClick({ preventDefault() {}, stopPropagation() {} })
        } else {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
        }
        await new Promise(r => setTimeout(r, 20))
    })
}

async function flush() {
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
}

async function mount(onSuccess = vi.fn()) {
    const result = render(<DeclarationWizard isOpen onOpenChange={vi.fn()} periodId={7} onSuccess={onSuccess} />)
    await flush()
    await flush()
    return result
}

function buttonByText(text: RegExp) {
    return screen.getAllByRole("button").find(b => text.test(b.textContent ?? "")) ?? null
}

function makePeriod(summary: Partial<NonNullable<TaxPeriodDetail["declaration_summary"]>> | null, status: TaxPeriodDetail["status"] = "OPEN"): TaxPeriodDetail {
    return {
        id: 7,
        year: 2026,
        month: 10,
        status,
        month_display: "Octubre",
        declaration_summary: summary
            ? { id: 55, vat_to_pay: 0, total_paid: 0, is_fully_paid: false, payments: [], document: null, ...summary }
            : undefined,
    }
}

const CALC = { year: 2026, month: 10, tax_period_id: 7, vat_debit: 0, vat_credit: 0, vat_credit_carryforward: 0, tax_rate: 19 }

beforeEach(() => {
    vi.clearAllMocks()
    m.declarations = null
    m.declarationsLoading = false
    m.calculateTax.mockResolvedValue(CALC)
    m.refetch.mockResolvedValue(undefined)
    m.uploadF29Document.mockResolvedValue(undefined)
})

describe("DeclarationWizard — fases", () => {
    it("abre en el paso Pago cuando hay declaración con saldo pendiente", async () => {
        m.period = makePeriod({ vat_to_pay: 100000, total_paid: 0, is_fully_paid: false })
        await mount()
        expect(screen.getByText("04 / 05")).toBeInTheDocument()
        expect(screen.getByText("Hay un saldo pendiente por pagar.")).toBeInTheDocument()
    })

    it("abre en el paso Cierre cuando el saldo está cubierto", async () => {
        m.period = makePeriod({ vat_to_pay: 100000, total_paid: 100000, is_fully_paid: true })
        await mount()
        expect(screen.getByText("05 / 05")).toBeInTheDocument()
        expect(buttonByText(/Confirmar Cierre/)).not.toBeNull()
    })

    it("omite el paso Pago cuando vat_to_pay es 0", async () => {
        m.period = makePeriod({ vat_to_pay: 0, total_paid: 0, is_fully_paid: true })
        await mount()
        expect(screen.getByText("04 / 04")).toBeInTheDocument()
        expect(screen.queryByText("Pago")).not.toBeInTheDocument()
        expect(buttonByText(/Confirmar Cierre/)).not.toBeNull()
    })

    it("los pasos previos quedan en solo lectura y no re-registran si ya hay declaración", async () => {
        m.period = makePeriod({ vat_to_pay: 100000, total_paid: 0, is_fully_paid: false })
        await mount()
        await press(buttonByText(/Anterior/)) // → Resumen
        expect(buttonByText(/Registrar Declaración/)).toBeNull()
        await press(buttonByText(/Anterior/)) // → Cargos manuales
        const inputs = Array.from(document.querySelectorAll("input"))
        expect(inputs.length).toBeGreaterThan(0)
        inputs.forEach(input => expect(input).toBeDisabled())

        await press(buttonByText(/Siguiente/)) // → Resumen
        await press(buttonByText(/Siguiente/)) // → Pago, sin registrar
        expect(m.createDeclaration).not.toHaveBeenCalled()
        expect(m.registerDeclaration).not.toHaveBeenCalled()
    })

    it("registrar la declaración no cierra el período", async () => {
        m.period = makePeriod(null)
        m.createDeclaration.mockResolvedValue({ id: 55, tax_period: 7 })
        m.registerDeclaration.mockResolvedValue({ id: 55 })
        await mount()
        expect(screen.getByText("01 / 04")).toBeInTheDocument()
        await press(buttonByText(/Siguiente/))
        await press(buttonByText(/Siguiente/))
        await press(buttonByText(/Registrar Declaración/))
        expect(m.registerDeclaration).toHaveBeenCalledTimes(1)
        expect(m.closePeriod).not.toHaveBeenCalled()
    })

    it("un fallo al registrar muestra el error y no avanza", async () => {
        m.period = makePeriod(null)
        m.createDeclaration.mockResolvedValue({ id: 55, tax_period: 7 })
        m.registerDeclaration.mockRejectedValue({ response: { data: { error: "Folio inválido" } } })
        await mount()
        await press(buttonByText(/Siguiente/))
        await press(buttonByText(/Siguiente/))
        await press(buttonByText(/Registrar Declaración/))
        expect(m.showApiError).toHaveBeenCalledTimes(1)
        expect(screen.getByText("03 / 04")).toBeInTheDocument()
    })
})

describe("DeclarationWizard — cierre", () => {
    async function attachPdf() {
        const input = document.querySelector("input[type=file]")
        if (!input) throw new Error("file input not found")
        const file = new File(["%PDF"], "f29.pdf", { type: "application/pdf" })
        await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
    }

    it("un fallo del cierre llama showApiError y no avanza", async () => {
        m.period = makePeriod({ vat_to_pay: 0, total_paid: 0, is_fully_paid: true })
        m.closePeriod.mockRejectedValue({ response: { status: 400, data: { error: "Hay pendientes" } } })
        const onSuccess = vi.fn()
        await mount(onSuccess)
        await attachPdf()
        await press(buttonByText(/Confirmar Cierre/))
        expect(m.closePeriod).toHaveBeenCalledTimes(1)
        expect(m.showApiError).toHaveBeenCalledTimes(1)
        expect(screen.getByText("04 / 04")).toBeInTheDocument()
        expect(buttonByText(/Confirmar Cierre/)).not.toBeNull()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it("el reintento tras un fallo usa una clave de idempotencia distinta", async () => {
        m.period = makePeriod({ vat_to_pay: 0, total_paid: 0, is_fully_paid: true })
        m.closePeriod
            .mockRejectedValueOnce({ response: { status: 400, data: { error: "Hay pendientes" } } })
            .mockResolvedValueOnce({ id: 7, status: "CLOSED" })
        await mount()
        await attachPdf()
        await press(buttonByText(/Confirmar Cierre/))
        await press(buttonByText(/Confirmar Cierre/))
        expect(m.closePeriod).toHaveBeenCalledTimes(2)
        const [first, second] = m.closePeriod.mock.calls.map(c => (c[0] as { idempotencyKey?: string }).idempotencyKey)
        expect(first).toBeTruthy()
        expect(second).toBeTruthy()
        expect(first).not.toBe(second)
    })
})

describe("DeclarationWizard — fase estable y estado por apertura", () => {
    it("si el registro falla tras crear, la fase no salta a Pago mientras carga la declaración", async () => {
        m.period = makePeriod(null)
        m.createDeclaration.mockImplementation(async () => {
            // The create invalidates the period: the refetch now carries a summary,
            // while the declarations list (is_registered) is still loading.
            m.period = makePeriod({ vat_to_pay: 100000, total_paid: 0, is_fully_paid: false })
            m.declarationsLoading = true
            return { id: 55, tax_period: 7 }
        })
        m.registerDeclaration.mockRejectedValue({ response: { data: { error: "Folio inválido" } } })
        const { rerender } = await mount()
        await press(buttonByText(/Siguiente/))
        await press(buttonByText(/Siguiente/))
        await press(buttonByText(/Registrar Declaración/))
        // Query refetch (period has a summary, declarations list still loading) re-renders the wizard.
        rerender(<DeclarationWizard isOpen onOpenChange={vi.fn()} periodId={7} onSuccess={vi.fn()} />)
        await flush()
        await flush()
        expect(m.showApiError).toHaveBeenCalledTimes(1)
        expect(screen.queryByText("Hay un saldo pendiente por pagar.")).not.toBeInTheDocument()
        expect(buttonByText(/Registrar Abono/)).toBeNull()

        // The list loads: the declaration exists but is not registered → still prior, on Resumen.
        m.declarationsLoading = false
        m.declarations = { results: [{ id: 55, is_registered: false, ppm_amount: 0 }] }
        rerender(<DeclarationWizard isOpen onOpenChange={vi.fn()} periodId={7} onSuccess={vi.fn()} />)
        await flush()
        await flush()
        expect(screen.getByText("03 / 04")).toBeInTheDocument()
        expect(buttonByText(/Registrar Declaración/)).not.toBeNull()
        expect(screen.queryByText("Hay un saldo pendiente por pagar.")).not.toBeInTheDocument()
        expect(buttonByText(/Registrar Abono/)).toBeNull()
    })

    it("la vista de período cerrado lista el historial de pagos sin botón Anular", async () => {
        m.period = makePeriod({
            vat_to_pay: 1000, total_paid: 1000, is_fully_paid: true, folio_number: "A-1",
            payments: [{ id: 1, payment_date: "2026-11-05", amount: 1000, payment_method_display: "Transferencia" }],
        }, "CLOSED")
        await mount()
        expect(screen.getByText("Período Cerrado", { selector: "h3" })).toBeInTheDocument()
        expect(screen.getByText("Historial de Pagos")).toBeInTheDocument()
        expect(screen.getByText("Transferencia")).toBeInTheDocument()
        expect(buttonByText(/Anular/)).toBeNull()
    })

    it("abrir otro período sin TaxPeriod nunca muestra los datos del período anterior", async () => {
        const onOpenChange = vi.fn()
        // Period A: closed.
        m.calculateTax.mockResolvedValueOnce(CALC)
        m.period = makePeriod({ vat_to_pay: 1000, total_paid: 1000, is_fully_paid: true, folio_number: "A-1" }, "CLOSED")
        const { rerender } = render(<DeclarationWizard isOpen onOpenChange={onOpenChange} year={2026} month={9} onSuccess={vi.fn()} />)
        await flush()
        await flush()
        expect(screen.getByText("Período Cerrado", { selector: "h3" })).toBeInTheDocument()

        rerender(<DeclarationWizard isOpen={false} onOpenChange={onOpenChange} year={2026} month={9} onSuccess={vi.fn()} />)
        await flush()

        // Period B: no TaxPeriod yet (backend answers tax_period_id null); calc still pending.
        let resolveB: (v: unknown) => void = () => {}
        m.calculateTax.mockImplementationOnce(() => new Promise(r => { resolveB = r }))
        rerender(<DeclarationWizard isOpen onOpenChange={onOpenChange} year={2026} month={10} onSuccess={vi.fn()} />)
        expect(screen.queryByText("Período Cerrado")).not.toBeInTheDocument()
        await flush()
        expect(screen.queryByText("Período Cerrado")).not.toBeInTheDocument()

        await act(async () => { resolveB({ ...CALC, tax_period_id: null }) })
        await flush()
        await flush()
        expect(screen.queryByText("Período Cerrado")).not.toBeInTheDocument()
        expect(screen.queryByText(/A-1/)).not.toBeInTheDocument()
        expect(screen.getByText("01 / 04")).toBeInTheDocument()
    })

    it("Confirmar Cierre queda deshabilitado sin archivo ni comprobante previo", async () => {
        m.period = makePeriod({ vat_to_pay: 0, total_paid: 0, is_fully_paid: true, document: null })
        await mount()
        expect(buttonByText(/Confirmar Cierre/)).toBeDisabled()
        const input = document.querySelector("input[type=file]")
        expect(input?.getAttribute("accept")).toContain("application/pdf")
    })
})

describe("DeclarationWizard — borradores y footer", () => {
    const INVOICE_DRAFT = { id: 1, display_id: "F-1", total: 1190, date: "2026-10-05", type: "sale" as const }
    const ENTRY_DRAFT = { id: 2, display_id: "A-2", description: "Ajuste", date: "2026-10-06" }

    it("bloquea Siguiente en la auditoría mientras haya facturas en borrador", async () => {
        m.period = makePeriod(null)
        m.calculateTax.mockResolvedValue({ ...CALC, drafts_summary: { invoices: [INVOICE_DRAFT], entries: [] } })
        await mount()
        const required = screen.getByRole("region", { name: "Obligatorios" })
        expect(required).toHaveTextContent("Sin facturas en borrador")
        expect(buttonByText(/Siguiente/)).toBeDisabled()
    })

    it("Obligatorios y Sugeridos van arriba del primer paso, lado a lado, y el contenido hace scroll", async () => {
        m.period = makePeriod(null)
        m.calculateTax.mockResolvedValue({ ...CALC, drafts_summary: { invoices: [INVOICE_DRAFT], entries: [ENTRY_DRAFT] } })
        await mount()
        const required = screen.getByRole("region", { name: "Obligatorios" })
        const suggested = screen.getByRole("region", { name: "Sugeridos" })

        expect(required.parentElement).toBe(suggested.parentElement)
        expect(required.parentElement?.className).toContain("md:grid-cols-2")
        const debit = screen.getByText("Débito Fiscal")
        expect(required.compareDocumentPosition(debit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(required.closest(".overflow-y-auto")).not.toBeNull()
    })

    it("los asientos en borrador solo se sugieren y no bloquean", async () => {
        m.period = makePeriod(null)
        m.calculateTax.mockResolvedValue({ ...CALC, drafts_summary: { invoices: [], entries: [ENTRY_DRAFT] } })
        await mount()
        expect(screen.getByRole("region", { name: "Sugeridos" })).toHaveTextContent("Sin asientos en borrador")
        expect(buttonByText(/Siguiente/)).not.toBeDisabled()
    })

    it("con la declaración ya registrada los borradores no bloquean la revisión", async () => {
        m.period = makePeriod({ vat_to_pay: 100000, total_paid: 0, is_fully_paid: false })
        m.calculateTax.mockResolvedValue({ ...CALC, drafts_summary: { invoices: [INVOICE_DRAFT], entries: [] } })
        await mount()
        await press(buttonByText(/Anterior/))
        await press(buttonByText(/Anterior/))
        await press(buttonByText(/Anterior/)) // → Auditoría
        expect(screen.getByText("01 / 05")).toBeInTheDocument()
        expect(buttonByText(/Siguiente/)).not.toBeDisabled()
    })

    it("Confirmar Cierre y Finalizar viven en el footer del modal", async () => {
        m.period = makePeriod({ vat_to_pay: 100000, total_paid: 100000, is_fully_paid: true })
        const { unmount } = await mount()
        const closeButton = buttonByText(/Confirmar Cierre/)
        expect(closeButton?.closest('[data-slot="dialog-footer"]')).not.toBeNull()
        unmount()

        m.period = makePeriod({ vat_to_pay: 1000, total_paid: 1000, is_fully_paid: true, folio_number: "A-1" }, "CLOSED")
        await mount()
        expect(buttonByText(/Finalizar/)?.closest('[data-slot="dialog-footer"]')).not.toBeNull()
    })
})
