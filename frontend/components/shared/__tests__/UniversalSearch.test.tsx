import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UniversalSearch } from "@/components/shared"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/features/search", () => ({ useUniversalSearch: () => ({ results: [], isLoading: false }) }))
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
})
