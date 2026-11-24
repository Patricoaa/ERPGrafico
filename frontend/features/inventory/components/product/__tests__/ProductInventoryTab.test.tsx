import { FormProvider, useForm } from "react-hook-form"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProductInventoryTab } from "../ProductInventoryTab"
import type { ProductFormValues } from "../schema"

vi.mock("@/components/shared", () => ({
    Section: { Header: ({ title }: { title: string }) => <h2>{title}</h2> },
    LabeledSwitch: ({ label }: { label: string }) => <div>{label}</div>,
    MultiSelectTagInput: ({ label }: { label: string }) => <div>{label}</div>,
    fadeInClass: () => "",
}))

vi.mock("@/components/selectors", () => ({
    UoMSelector: ({ label }: { label: string }) => <div>{label}</div>,
    WarehouseSelector: ({ label }: { label: string }) => <div>{label}</div>,
    AdvancedContactSelector: ({ label }: { label: string }) => <div>{label}</div>,
}))

function InventoryTabHarness({
    productType,
    canBeSold = true,
    canBePurchased = true,
    trackInventory,
}: {
    productType: string
    canBeSold?: boolean
    canBePurchased?: boolean
    trackInventory?: boolean
}) {
    const form = useForm<ProductFormValues>({
        defaultValues: {
            product_type: productType,
            can_be_sold: canBeSold,
            can_be_purchased: canBePurchased,
            track_inventory: trackInventory ?? (productType === "STORABLE"),
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

    it("keeps the existing logistics controls for storable products with stock tracking enabled", () => {
        render(<InventoryTabHarness productType="STORABLE" trackInventory={true} />)

        expect(screen.getByText("Unidad de Stock (Base)")).toBeInTheDocument()
        expect(screen.getByText("Unidad de Compra")).toBeInTheDocument()
        expect(screen.getByText("Control y Abastecimiento")).toBeInTheDocument()
        expect(screen.getByText("Seguimiento de Inventario")).toBeInTheDocument()
        expect(screen.getByText("Bodega de Recepción")).toBeInTheDocument()
        expect(screen.getByText("Proveedor Preferencial")).toBeInTheDocument()
    })

    it("hides Control y Abastecimiento section when track_inventory is false", () => {
        render(<InventoryTabHarness productType="MANUFACTURABLE" trackInventory={false} />)

        expect(screen.getByText("Unidad de Stock (Base)")).toBeInTheDocument()
        expect(screen.queryByText("Control y Abastecimiento")).not.toBeInTheDocument()
        expect(screen.queryByText("Seguimiento de Inventario")).not.toBeInTheDocument()
        expect(screen.queryByText("Bodega de Recepción")).not.toBeInTheDocument()
        expect(screen.queryByText("Proveedor Preferencial")).not.toBeInTheDocument()
    })

    it("shows Control y Abastecimiento section when track_inventory is true for manufacturable products", () => {
        render(<InventoryTabHarness productType="MANUFACTURABLE" trackInventory={true} />)

        expect(screen.getByText("Unidad de Stock (Base)")).toBeInTheDocument()
        expect(screen.getByText("Control y Abastecimiento")).toBeInTheDocument()
        expect(screen.getByText("Bodega de Recepción")).toBeInTheDocument()
        expect(screen.getByText("Proveedor Preferencial")).toBeInTheDocument()
    })

    it("hides Unidad de Compra when can_be_purchased is false", () => {
        render(<InventoryTabHarness productType="STORABLE" canBePurchased={false} />)

        expect(screen.queryByText("Unidad de Compra")).not.toBeInTheDocument()
    })

    it("shows Unidad de Compra when can_be_purchased is true and not a service", () => {
        render(<InventoryTabHarness productType="STORABLE" canBePurchased={true} />)

        expect(screen.getByText("Unidad de Compra")).toBeInTheDocument()
    })

    it("hides Unidades de Venta Permitidas when can_be_sold is false", () => {
        render(<InventoryTabHarness productType="STORABLE" canBeSold={false} />)

        expect(screen.queryByText("Unidades de Venta Permitidas")).not.toBeInTheDocument()
    })

    it("shows Unidades de Venta Permitidas when can_be_sold is true", () => {
        render(<InventoryTabHarness productType="STORABLE" canBeSold={true} />)

        expect(screen.getByText("Unidades de Venta Permitidas")).toBeInTheDocument()
    })
})