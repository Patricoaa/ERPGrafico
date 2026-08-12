import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { ProductSelector } from "../ProductSelector"
import type { Product } from "@/types/entities"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock("@/lib/api", () => ({
    default: {
        get: getMock,
    },
}))

const storable: Product = {
    id: 1,
    code: "S1",
    name: "Materia Prima",
    product_type: "STORABLE",
    sale_price: 100,
}
const manufacturable: Product = {
    id: 2,
    code: "M1",
    name: "Producto Fabricado",
    product_type: "MANUFACTURABLE",
    sale_price: 200,
}
const service: Product = {
    id: 3,
    code: "SV1",
    name: "Servicio Externo",
    product_type: "SERVICE",
    sale_price: 300,
}

const queryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false } } })

const renderSelector = (props: React.ComponentProps<typeof ProductSelector>) =>
    render(
        <QueryClientProvider client={queryClient()}>
            <ProductSelector {...props} />
        </QueryClientProvider>
    )

const listUrl = () => {
    const url = getMock.mock.calls.find((call) => String(call[0]).includes("/inventory/products/?"))
    return url ? (url[0] as string) : ""
}

const queryOf = (url: string) => new URLSearchParams(url.split("?")[1])

const simulateBackendFilter = (results: Product[], url: string): Product[] => {
    const q = queryOf(url)
    const exact = q.get("product_type")
    const inList = q.get("product_type__in")?.split(",") ?? []
    if (exact) return results.filter((p) => p.product_type === exact)
    if (inList.length > 0) return results.filter((p) => inList.includes(p.product_type))
    return results
}

const openSelector = async (results: Product[], expectedText?: string) => {
    getMock.mockImplementation((url: string) =>
        Promise.resolve({ data: { results: simulateBackendFilter(results, url) } })
    )
    fireEvent.click(screen.getByRole("combobox"))
    if (expectedText) {
        await waitFor(() => {
            expect(screen.getByText(expectedText)).toBeInTheDocument()
        })
    }
}

beforeEach(() => {
    getMock.mockReset()
})

describe("ProductSelector productTypes query mapping", () => {
    it("sends a single product_type param for a single type", async () => {
        renderSelector({ onChange: vi.fn(), productTypes: ["MANUFACTURABLE"] })
        await openSelector([manufacturable])
        const q = queryOf(listUrl())
        expect(q.get("product_type")).toBe("MANUFACTURABLE")
        expect(q.get("product_type__in")).toBeNull()
        expect(q.get("parent_template__isnull")).toBe("true")
    })

    it("sends product_type__in (comma encoded) for multiple types", async () => {
        renderSelector({ onChange: vi.fn(), productTypes: ["STORABLE", "MANUFACTURABLE"] })
        await openSelector([storable, manufacturable])
        const url = listUrl()
        expect(url).toContain("%2C")
        expect(queryOf(url).get("product_type__in")).toBe("STORABLE,MANUFACTURABLE")
    })

    it("sends can_be_purchased=true when enabled", async () => {
        renderSelector({ onChange: vi.fn(), canBePurchased: true })
        await openSelector([service])
        expect(queryOf(listUrl()).get("can_be_purchased")).toBe("true")
    })

    it("sends can_be_sold=true when enabled", async () => {
        renderSelector({ onChange: vi.fn(), canBeSold: true })
        await openSelector([storable])
        expect(queryOf(listUrl()).get("can_be_sold")).toBe("true")
    })
})

describe("ProductSelector client-side behavior", () => {
    it("applies customFilter to the fetched set", async () => {
        renderSelector({
            onChange: vi.fn(),
            customFilter: (p) => p.product_type === "STORABLE",
        })
        await openSelector([storable, manufacturable, service], "Materia Prima")
        expect(screen.queryByText("Producto Fabricado")).not.toBeInTheDocument()
        expect(screen.queryByText("Servicio Externo")).not.toBeInTheDocument()
    })

    it("shows EmptyState when there are no results", async () => {
        renderSelector({ onChange: vi.fn() })
        await openSelector([], "No se encontraron productos")
    })
})

describe("ProductSelector BOM material regression", () => {
    it("requests ONLY STORABLE for BOM materials and renders only that set", async () => {
        renderSelector({ onChange: vi.fn(), productTypes: ["STORABLE"] })
        await openSelector([storable, manufacturable, service], "Materia Prima")
        const q = queryOf(listUrl())
        expect(q.get("product_type")).toBe("STORABLE")
        expect(q.get("product_type__in")).toBeNull()
        expect(screen.queryByText("Producto Fabricado")).not.toBeInTheDocument()
        expect(screen.queryByText("Servicio Externo")).not.toBeInTheDocument()
    })

    it("renders a MANUFACTURABLE value outside the filter set in the trigger (edit mode)", async () => {
        getMock.mockImplementation((url: string) => {
            if (url.includes("/inventory/products/2/")) {
                return Promise.resolve({ data: manufacturable })
            }
            return Promise.resolve({ data: { results: [storable] } })
        })
        renderSelector({ onChange: vi.fn(), value: manufacturable.id, productTypes: ["STORABLE"] })
        await waitFor(() => {
            expect(screen.getByText("Producto Fabricado")).toBeInTheDocument()
        })
        fireEvent.click(screen.getByRole("combobox"))
        await waitFor(() => {
            expect(screen.getByText("Materia Prima")).toBeInTheDocument()
        })
        expect(screen.queryByText("Producto Fabricado")).toBeInTheDocument()
        expect(screen.queryByText("Servicio Externo")).not.toBeInTheDocument()
    })
})

describe("ProductSelector simple-only predicate (partners)", () => {
    const simpleManufacturable: Product = {
        ...manufacturable,
        requires_advanced_manufacturing: false,
        mfg_auto_finalize: false,
    }
    const advancedManufacturable: Product = {
        ...manufacturable,
        name: "Fab Avanzada",
        id: 4,
        requires_advanced_manufacturing: true,
    }
    const expressManufacturable: Product = {
        ...manufacturable,
        name: "Fab Express",
        id: 5,
        mfg_auto_finalize: true,
    }

    it("excludes advanced and express manufacturables via customFilter", async () => {
        const simpleOnly = (p: Product) =>
            !(
                p.product_type === "MANUFACTURABLE" &&
                (p.requires_advanced_manufacturing || p.mfg_auto_finalize)
            )
        renderSelector({
            onChange: vi.fn(),
            productTypes: ["STORABLE", "MANUFACTURABLE"],
            customFilter: simpleOnly,
        })
        await openSelector(
            [storable, simpleManufacturable, advancedManufacturable, expressManufacturable],
            "Materia Prima"
        )
        expect(screen.getByText("Producto Fabricado")).toBeInTheDocument()
        expect(screen.queryByText("Fab Avanzada")).not.toBeInTheDocument()
        expect(screen.queryByText("Fab Express")).not.toBeInTheDocument()
    })
})
