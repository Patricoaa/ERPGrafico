import { render, screen, act, waitFor, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { GlobalModalProvider, EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { WarehouseDrawer } from "../WarehouseDrawer"

const nav = vi.hoisted(() => {
    let query = ""
    const listeners = new Set<() => void>()
    return {
        get query() { return query },
        set(q: string) { query = q; listeners.forEach(l => l()) },
        subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    }
})
vi.mock("next/navigation", async () => {
    const React = await import("react")
    return {
        usePathname: () => "/inventory/warehouses",
        useRouter: () => ({ replace: (url: string) => setTimeout(() => nav.set(url.split("?")[1] ?? ""), 0), push: vi.fn() }),
        useSearchParams: () => new URLSearchParams(React.useSyncExternalStore(nav.subscribe, () => nav.query)),
    }
})
vi.mock("@/hooks/useSelectedEntity", () => ({
    useSelectedEntity: (o: { endpoint: string | null }) => ({ entity: o.endpoint ? { id: 5, name: "Central", code: "C1", address: "" } : null, isLoading: false, clearSelection: vi.fn() }),
}))
const save = vi.hoisted(() => vi.fn(async () => { await new Promise(r => setTimeout(r, 30)) }))
vi.mock("../../hooks/useWarehouseMutations", () => ({ useWarehouseMutations: () => ({ saveWarehouse: save }) }))
vi.mock("@/features/audit", () => ({ ActivitySidebar: () => null }))
const holder = vi.hoisted(() => ({ Drawer: null as null | ((p: Record<string, unknown>) => React.ReactNode) }))
vi.mock("@/lib/entity-drawers", () => {
    const drawers = {
        "inventory.warehouse": ({ open, onOpenChange, data, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; data?: unknown; onSuccess?: () => void }) => {
            const D = holder.Drawer!
            return <D open={open} onOpenChange={onOpenChange} initialData={data} onSuccess={() => onSuccess?.()} />
        },
    }
    return { ENTITY_DRAWERS: drawers, hasEntityDrawer: (l: string) => l in drawers }
})

function Tabs() {
    const { tabs } = useGlobalModals()
    return <span>tabs:{tabs.map(t => t.title).join(",")}</span>
}

function Page() {
    const panel = useEntityPanelRoute<{ id: number; name: string; code: string; address: string }>({ endpoint: "/inventory/warehouses" })
    return (
        <EntityPanelTab label="inventory.warehouse" {...panel.tab}>
            {(open) => <WarehouseDrawer open={open} onOpenChange={(o) => { if (!o) panel.close() }} initialData={panel.entity ?? undefined} />}
        </EntityPanelTab>
    )
}

holder.Drawer = WarehouseDrawer as unknown as (p: Record<string, unknown>) => React.ReactNode
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

function Opener() {
    const { openEntity } = useGlobalModals()
    return <button onClick={() => openEntity("inventory.warehouse", 5, { id: 5, name: "Central", code: "C1", address: "" })}>abrir</button>
}

/** ADR-0101: guardar cierra la pestaña (panel de la página o pestaña de entidad) sin la guarda de cambios. */
describe("WarehouseDrawer in a workspace tab", () => {
    beforeEach(() => { nav.set(""); save.mockClear() })

    it("saving an entity tab closes it without the unsaved-changes dialog", async () => {
        render(<GlobalModalProvider><Opener /><Tabs /></GlobalModalProvider>)
        act(() => screen.getByText("abrir").click())
        const name = await screen.findByPlaceholderText("Ej: Bodega Central")
        fireEvent.change(name, { target: { value: "Nueva" } })
        await act(async () => { screen.getByRole("button", { name: /Guardar Cambios/ }).click() })
        await waitFor(() => expect(save).toHaveBeenCalled())
        await act(async () => { await new Promise(r => setTimeout(r, 200)) })
        expect(screen.queryByText("Cambios sin guardar")).toBeNull()
        expect(screen.getByText(/^tabs:/).textContent).toBe("tabs:")
    })

    for (const q of ["selected=5", "modal=new"]) {
        it(`saving the page panel closes its tab without the unsaved-changes dialog (${q})`, async () => {
            nav.set(q)
            render(<GlobalModalProvider><Page /><Tabs /></GlobalModalProvider>)
            await waitFor(() => expect(screen.getByText(/tabs:.+/)).toBeInTheDocument())
            const name = await screen.findByPlaceholderText("Ej: Bodega Central")
            fireEvent.change(name, { target: { value: "Nueva" } })
            const code = document.querySelector<HTMLInputElement>("input[name=code]")!
            fireEvent.change(code, { target: { value: "N1" } })
            await act(async () => { screen.getByRole("button", { name: /Guardar Cambios|Crear Almacén/ }).click() })
            await waitFor(() => expect(save).toHaveBeenCalled())
            await act(async () => { await new Promise(r => setTimeout(r, 200)) })
            expect(screen.queryByText("Cambios sin guardar")).toBeNull()
            expect(screen.getByText(/^tabs:/).textContent).toBe("tabs:")
        })
    }
})
