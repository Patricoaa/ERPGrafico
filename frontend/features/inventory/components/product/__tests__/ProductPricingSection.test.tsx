import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Form } from "@/components/ui/form"
import { ProductPricingSection } from "../ProductPricingSection"
import type { ProductFormValues } from "../schema"

vi.mock("@/hooks/useVatRate", () => ({ useVatRate: () => ({ rate: 19, multiplier: 1.19, isLoading: false }) }))

const numberInputs = (c: HTMLElement) => c.querySelectorAll<HTMLInputElement>("input[placeholder=\"0\"]")
let values: () => Partial<ProductFormValues> = () => ({})
const onForm = (get: () => Partial<ProductFormValues>) => { values = get }

function Host({ onForm }: { onForm: (get: () => Partial<ProductFormValues>) => void }) {
    const form = useForm<ProductFormValues>({
        defaultValues: { sale_price: 0, sale_price_gross: 0, is_dynamic_pricing: false, product_type: "STORABLE", allowed_sale_uoms: [] } as Partial<ProductFormValues> as ProductFormValues,
    })
    useEffect(() => { onForm(() => form.getValues()) }, [form, onForm])
    return (
        <Form {...form}>
            <ProductPricingSection form={form} canBeSold uoms={[]} />
        </Form>
    )
}

describe("ProductPricingSection (ADR-0151)", () => {
    it("neto 1218 fija bruto 1449 y muestra neto 1218", () => {
        const { container } = render(<Host onForm={onForm} />)
        fireEvent.change(numberInputs(container)[0], { target: { value: "1218" } })
        expect(values().sale_price_gross).toBe(1449)
        expect(values().sale_price).toBe(1218)
    })
    it("bruto 1450 fija neto 1218", () => {
        const { container } = render(<Host onForm={onForm} />)
        fireEvent.change(numberInputs(container)[1], { target: { value: "1450" } })
        expect(values().sale_price_gross).toBe(1450)
        expect(values().sale_price).toBe(1218)
    })
})
