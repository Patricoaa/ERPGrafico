import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { CategorySelector } from "../CategorySelector"
import type { ProductCategory } from "@/types/entities"

const { useCategoriesMock } = vi.hoisted(() => ({
    useCategoriesMock: vi.fn<() => { categories: ProductCategory[]; isLoading: boolean }>(),
}))

vi.mock("@/features/inventory/hooks/useCategories", () => ({
    useCategories: () => useCategoriesMock(),
}))

vi.mock("@/features/inventory/components/CategoryDrawer", () => ({
    CategoryDrawer: () => null,
}))

// Stub only DynamicIcon so the test can assert the exact Lucide name received.
vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        DynamicIcon: ({ name, className }: { name: string; className?: string }) => (
            <span data-testid="dynamic-icon" data-icon={name} className={className} />
        ),
    }
})

const categories = [
    { id: 1, name: "Bebidas", icon: "Coffee" },
    { id: 2, name: "Panadería", icon: "Croissant" },
    { id: 3, name: "Sin icono" },
] as ProductCategory[]

const renderSelector = (props: Partial<React.ComponentProps<typeof CategorySelector>> = {}) =>
    render(<CategorySelector onChange={vi.fn()} {...props} />)

const iconNames = () =>
    screen.getAllByTestId("dynamic-icon").map((el) => el.getAttribute("data-icon"))

describe("CategorySelector", () => {
    beforeEach(() => {
        useCategoriesMock.mockReturnValue({ categories, isLoading: false })
    })

    it("muestra el icono real de cada categoría en la lista", async () => {
        renderSelector()

        fireEvent.click(screen.getByRole("combobox"))

        await waitFor(() => expect(screen.getByText("Bebidas")).toBeTruthy())
        expect(iconNames()).toEqual(["Coffee", "Croissant"])
    })

    it("muestra el icono real de la categoría seleccionada en el trigger", () => {
        renderSelector({ value: "1" })

        expect(screen.getByText("Bebidas")).toBeTruthy()
        expect(iconNames()).toEqual(["Coffee"])
    })

    it("cae al icono genérico cuando la categoría no tiene icono", async () => {
        renderSelector({ value: "3" })

        expect(screen.getByText("Sin icono")).toBeTruthy()
        expect(screen.queryByTestId("dynamic-icon")).toBeNull()
    })

    it("respeta un icono explícito pasado por prop", () => {
        renderSelector({ value: "1", icon: <span data-testid="custom-icon" /> })

        expect(screen.getByTestId("custom-icon")).toBeTruthy()
        expect(screen.queryByTestId("dynamic-icon")).toBeNull()
    })
})
