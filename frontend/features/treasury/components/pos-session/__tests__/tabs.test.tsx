import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ClosingTab } from "../ClosingTab"
import { SummaryTab } from "../SummaryTab"
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: vi.fn() }),
    useOptionalGlobalModals: () => undefined,
}))

import type { POSSession, POSSessionOverview } from "../../../types"

const session = {
    id: 5, user_name: "Ana Pérez", closed_by_name: "Luis Soto", opened_at: "2026-11-10T12:00:00Z",
    closed_at: "2026-11-10T20:00:00Z", opening_balance: 10000, treasury_account_name: "Caja 1",
    terminal_details: { id: 1, name: "Mostrador", code: "T-1", location: null }, status: "CLOSED",
} as unknown as POSSession

const overview: POSSessionOverview = {
    timezone: "America/Santiago",
    alerts: [{ code: "CASH_DIFFERENCE", severity: "destructive", tab: "closing", amount: -2000, message: "El efectivo contado es inferior al esperado." }],
    sales: { gross: 15000, returns_total: 2000, net: 13000, sale_count: 2, return_count: 1, includes_tax: true, average_ticket: 7500, collection_count: 0, rows: [] },
    collections: [
        { key: "pm-1", method_id: 1, method: "CASH", label: "Efectivo", enabled: true, amount: 8000, share: 61.54 },
        { key: "pm-2", method_id: 2, method: "TRANSFER", label: "Transferencia BancoEstado", enabled: false, amount: 5000, share: 38.46 },
    ],
    closing: {
        closed_at: "2026-11-10T20:00:00Z", closed_by_id: 2, closed_by_name: "Luis Soto", expected_cash: 18000,
        counted_cash: 16000, difference: -2000, result: "DIFFERENCE", notes: "Faltante tras recuento", notes_author: "Luis Soto",
        notes_at: "2026-11-10T20:00:00Z",
    },
}

describe("POSSession summary tab", () => {
    it("muestra la alerta primero y lleva al cierre", async () => {
        const onGoTab = vi.fn()
        render(<SummaryTab session={session} overview={overview} isLoading={false} onGoTab={onGoTab} />)

        expect(screen.getByText("El efectivo contado es inferior al esperado.")).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Ir al cierre" }))
        expect(onGoTab).toHaveBeenCalledWith("closing")
        expect(screen.getByText("Ticket medio bruto")).toBeInTheDocument()
        expect(screen.getByText("62%")).toBeInTheDocument()
        expect(screen.getByRole("img", { name: /Efectivo 62%, Transferencia BancoEstado 38%/ })).toBeInTheDocument()
        expect(screen.getByText("Cobros por métodos")).toBeInTheDocument()
        expect(screen.getByText("Transferencia BancoEstado")).toBeInTheDocument()
        expect(screen.getByText("(ya no habilitado)")).toBeInTheDocument()
        expect(screen.queryByText(/no son ventas brutas/)).not.toBeInTheDocument()
        expect(screen.queryByText("Indicadores")).not.toBeInTheDocument()
    })

    it("Información operativa respeta el orden pedido", () => {
        render(<SummaryTab session={session} overview={overview} isLoading={false} onGoTab={vi.fn()} />)
        const labels = Array.from(document.querySelectorAll("section[aria-label='Información operativa'] dt")).map((n) => n.textContent)
        expect(labels).toEqual([
            "Punto de venta", "Responsable de apertura", "Fecha de apertura", "Fondo de apertura",
            "Responsable de cierre", "Fecha y hora de cierre", "Fondo final",
        ])
    })

    it("sin alertas no dibuja la sección de alertas", () => {
        render(<SummaryTab session={session} overview={{ ...overview, alerts: [] }} isLoading={false} onGoTab={vi.fn()} />)
        expect(screen.queryByLabelText("Alertas")).not.toBeInTheDocument()
    })
})

describe("POSSession closing tab", () => {
    it("distingue coincidencia de revisión y muestra las observaciones con autor", () => {
        render(<ClosingTab session={session} overview={overview} isLoading={false} />)
        expect(screen.getByText("Faltante tras recuento")).toBeInTheDocument()
        expect(screen.getByText("Con diferencia")).toBeInTheDocument()
        expect(screen.queryByText(/solo declara el efectivo contado/)).not.toBeInTheDocument()
        expect(screen.getByText("Cerrada por")).toBeInTheDocument()
    })

    it("sesión abierta: aún no hay cierre", () => {
        render(<ClosingTab session={{ ...session, closed_at: null }} overview={overview} isLoading={false} />)
        expect(screen.getByText("La sesión sigue abierta")).toBeInTheDocument()
    })
})
