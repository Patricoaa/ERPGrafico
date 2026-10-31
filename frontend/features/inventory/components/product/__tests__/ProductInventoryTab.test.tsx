import { FormProvider, useForm } from "react-hook-form"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProductInventoryTab } from "../ProductInventoryTab"
import type { ProductFormValues } from "../schema"

vi.mock("@/components/shared", () => ({
    FormSection: ({ title }: { title: string }) => <h2>{title}</h2>,
    LabeledSwitch: ({ label }: { label: string }) => <div>{label}</div>,
    MultiSelectTagInput: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock("@/components/selectors", () => ({
    UoMSelector: ({ label }: { label: string }) => <div>{label}</div>,
    WarehouseSelector: ({ label }: { label: string }) => <div>{label}</div>,
    AdvancedContactSelector: ({ label }: { label: string }) => <div>{label}</div>,
}))

function InventoryTabHarness({ productType }: { productType: string }) {
    const form = useForm<ProductFormValues>({
        defaultValues: {
            product_type: productType,
            can_be_sold: true,
            can_be_purchased: true,
            track_inventory: false,
            uom: "",
            purchase_uom: "",
            allowed_sale_uoms: [],
            mfg_auto_finalize: false,
            requires_advanced_manufacturing: false,
        },
    })

    return (
        <FormProvider {...form}>
            <ProductInventoryTab form={form} />
        </FormProvider>
    )
}

describe("ProductInventoryTab", () => {
    it("shows service units without inventory, warehouse, or supply controls", () => {
        render(<InventoryTabHarness productType="SERVICE" />)

        expect(screen.getByText("Unidad Base")).toBeInTheDocument()
        expect(screen.getByText("Unidades de Venta Permitidas")).toBeInTheDocument()
        expect(screen.queryByText("Unidad de Stock (Base)")).not.toBeInTheDocument()
        expect(screen.queryByText("Unidad de Compra")).not.toBeInTheDocument()
        expect(screen.queryByText("Control y Abastecimiento")).not.toBeInTheDocument()
        expect(screen.queryByText("Seguimiento de Inventario")).not.toBeInTheDocument()
        expect(screen.queryByText("Bodega de Recepción")).not.toBeInTheDocument()
        expect(screen.queryByText("Proveedor Preferencial")).not.toBeInTheDocument()
    })

    it("keeps the existing logistics controls for storable products", () => {
        render(<InventoryTabHarness productType="STORABLE" />)

        expect(screen.getByText("Unidad de Stock (Base)")).toBeInTheDocument()
        expect(screen.getByText("Unidad de Compra")).toBeInTheDocument()
        expect(screen.getByText("Control y Abastecimiento")).toBeInTheDocument()
        expect(screen.getByText("Seguimiento de Inventario")).toBeInTheDocument()
        expect(screen.getByText("Bodega de Recepción")).toBeInTheDocument()
        expect(screen.getByText("Proveedor Preferencial")).toBeInTheDocument()
    })
})