import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UniversalSearch } from "@/components/shared"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    openEntity: vi.fn(),
    results: [] as Array<Record<string, unknown>>,
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/features/search", () => ({ useUniversalSearch: () => ({ results: mocks.results, isLoading: false }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({ useGlobalModals: () => ({ openEntity: mocks.openEntity }) }))

const ORDER = { label: "sales.saleorder", id: 7, display: "OV-7", title: "Orden", title_plural: "Órdenes", icon: "receipt", content_type_id: 1 }
vi.mock("@/contexts/BrandingProvider", () => ({ useBranding: () => ({ logo: null, company: null }) }))

describe("UniversalSearch", () => {
    it("conserva lo que se escribe con el diálogo abierto", async () => {
        const user = userEvent.setup()
        render(<UniversalSearch />)
        await user.click(screen.getByRole("button", { name: /búsqueda universal/i }))
        const input = await screen.findByRole("combobox")
        await user.type(input, "factura 12")
        expect(input).toHaveValue("factura 12")
    })

    it("limpia la búsqueda al volver a abrir", async () => {
        const user = userEvent.setup()
        render(<UniversalSearch />)
        const trigger = screen.getByRole("button", { name: /búsqueda universal/i })
        await user.click(trigger)
        await user.type(await screen.findByRole("combobox"), "abc")
        await user.click(screen.getByRole("button", { name: /cerrar búsqueda/i }))
        await user.click(trigger)
        expect(await screen.findByRole("combobox")).toHaveValue("")
    })

    describe("elegir un resultado abre su registro sin navegar", () => {
        beforeEach(() => {
            mocks.results = [ORDER]
            mocks.openEntity.mockReset()
            mocks.push.mockReset()
        })
        afterEach(() => { mocks.results = [] })

        it("con Enter", async () => {
            const user = userEvent.setup()
            render(<UniversalSearch />)
            await user.click(screen.getByRole("button", { name: /búsqueda universal/i }))
            await user.type(await screen.findByRole("combobox"), "ov{Enter}")
            expect(mocks.openEntity).toHaveBeenCalledWith("sales.saleorder", 7, undefined, undefined, { display: "OV-7" })
            expect(mocks.push).not.toHaveBeenCalled()
            expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
        })

        it("con clic en la fila", async () => {
            const user = userEvent.setup()
            render(<UniversalSearch />)
            await user.click(screen.getByRole("button", { name: /búsqueda universal/i }))
            await user.click(await screen.findByRole("option", { name: /OV-7/ }))
            expect(mocks.openEntity).toHaveBeenCalledWith("sales.saleorder", 7, undefined, undefined, { display: "OV-7" })
            expect(mocks.push).not.toHaveBeenCalled()
        })
    })
})
