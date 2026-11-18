import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RcvImportDetail } from "../../types"

const m = vi.hoisted(() => ({ imp: undefined as unknown, isError: false }))

vi.mock("../../hooks/useRcvImports", () => ({
    useRcvImport: () => ({ rcvImport: m.imp, isLoading: false, isError: m.isError }),
}))
vi.mock("@/features/_shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/_shared")>(),
    useDrawerIdentity: (_label: string, _mode: string, _data: unknown, opts?: { overrideTitle?: string }) => ({
        title: opts?.overrideTitle ?? "Importación", subtitle: "", icon: null,
    }),
}))

import { RcvImportDrawer } from "../rcv/RcvImportDrawer"

const imp: RcvImportDetail = {
    id: 5, direction: "SALES", year: 2026, month: 10, period: "2026-10", trigger: "MANUAL", status: "SUCCESS",
    triggered_by: 1, triggered_by_name: "Ana Prueba",
    started_at: "2026-11-14T10:00:00-03:00", finished_at: "2026-11-14T10:01:05-03:00",
    error_code: "", error_message: "", warnings: ["El detalle del tipo 48 no cuadra con el resumen del SII."],
    received_count: 12, created_count: 10, updated_count: 2, missing_count: 1, contacts_created_count: 3,
    api_key: 2, masked_key: "••••4472", created_at: "2026-11-14T10:00:00-03:00",
    summaries: [{
        id: 1, dte_type: 48, dte_type_label: "Comprobante de Pago Electrónico", document_count: 30,
        exempt_amount: "0", net_amount: "100000", vat_recoverable: "19000", vat_common_use: "0", vat_non_recoverable: "0",
        total_amount: "119000", status: "", has_detail: false, detail_count: 0, detail_total: "0",
    }],
    attempts: [{
        id: 1, api_key: 1, masked_key: "••••1111", http_status: 429, outcome: "QUOTA_EXHAUSTED", duration_ms: 1500,
        error_message: "", rate_limit_remaining: 0, created_at: "2026-11-14T10:00:01-03:00",
    }],
    raw_response: { folio: 4521 },
    updated_at: "2026-11-14T10:01:05-03:00",
}

beforeEach(() => {
    m.imp = imp
    m.isError = false
})

describe("RcvImportDrawer", () => {
    it("muestra el resumen con 'Solo resumen' para la fila 48", () => {
        render(<RcvImportDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("48 · Comprobante de Pago Electrónico")).toBeInTheDocument()
        expect(screen.getByText("Solo resumen")).toBeInTheDocument()
    })

    it("muestra el intento 'Sin cupo' con la key enmascarada", () => {
        render(<RcvImportDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("Sin cupo")).toBeInTheDocument()
        expect(screen.getByText("••••1111")).toBeInTheDocument()
    })

    it("muestra estado, usuario, duración y los avisos en un banner", () => {
        render(<RcvImportDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("Exitosa con avisos")).toBeInTheDocument()
        expect(screen.getByText("Ana Prueba")).toBeInTheDocument()
        expect(screen.getByText("1:05")).toBeInTheDocument()
        expect(screen.getByText("El detalle del tipo 48 no cuadra con el resumen del SII.")).toBeInTheDocument()
        expect(screen.getByText("Contactos creados")).toBeInTheDocument()
    })

    it("muestra el error de una importación fallida", () => {
        m.imp = { ...imp, status: "FAILED", warnings: [], error_message: "Clave SII rechazada", started_at: null, finished_at: null }
        render(<RcvImportDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("Clave SII rechazada")).toBeInTheDocument()
        expect(screen.getByText("Fallida")).toBeInTheDocument()
    })

    it("la respuesta original va plegada hasta pedirla", async () => {
        render(<RcvImportDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.queryByText(/"folio": 4521/)).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Mostrar/ }))
        expect(screen.getByText(/"folio": 4521/)).toBeInTheDocument()
    })

    it("si la carga falla muestra el error", () => {
        m.imp = undefined
        m.isError = true
        render(<RcvImportDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("No se pudo cargar la importación")).toBeInTheDocument()
    })
})
