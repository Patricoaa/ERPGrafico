import { describe, it, expect } from "vitest"

import { resolvePageTabs } from "../workspacePageTabs"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"

const navigation: NavigationConfig = {
    moduleName: "Ventas",
    activeValue: "documents",
    subActiveValue: "dtes",
    tabs: [
        {
            value: "documents", label: "Documentos", href: "/sales/dtes/orders",
            subTabs: [
                { value: "orders", label: "Órdenes de Venta", href: "/sales/dtes/orders" },
                { value: "dtes", label: "Documentos Tributarios", href: "/sales/dtes/invoices" },
                { value: "deliveries", label: "Despachos y Devoluciones", href: "/sales/deliveries", permission: "sales.view_delivery" },
            ],
        },
        { value: "credits", label: "Cartera de Créditos", href: "/sales/credits" },
    ],
}

const can = () => true

describe("resolvePageTabs", () => {
    it("lists the sibling views of the active group and marks the current one", () => {
        const tabs = resolvePageTabs(navigation, "/sales/dtes/invoices", can)
        expect(tabs.map((t) => t.label)).toEqual(["Órdenes de Venta", "Documentos Tributarios", "Despachos y Devoluciones"])
        expect(tabs.filter((t) => t.active).map((t) => t.label)).toEqual(["Documentos Tributarios"])
    })

    it("hides views the user cannot see", () => {
        const tabs = resolvePageTabs(navigation, "/sales/dtes/orders", (permission) => permission !== "sales.view_delivery")
        expect(tabs.map((t) => t.key)).toEqual(["orders", "dtes"])
    })

    it("falls back to the module's groups when the active group has no sibling views", () => {
        const flat: NavigationConfig = { ...navigation, activeValue: "credits", subActiveValue: undefined }
        const tabs = resolvePageTabs(flat, "/sales/credits", can)
        expect(tabs.map((t) => t.label)).toEqual(["Documentos", "Cartera de Créditos"])
        expect(tabs.find((t) => t.active)?.label).toBe("Cartera de Créditos")
    })

    it("returns nothing without module navigation (dashboard)", () => {
        expect(resolvePageTabs(undefined, "/", can)).toEqual([])
        expect(resolvePageTabs({ ...navigation, tabs: [] }, "/", can)).toEqual([])
    })
})
