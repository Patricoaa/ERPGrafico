import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"

import { useEntityPanelRoute, type UseEntityPanelRouteOptions } from "../useEntityPanelRoute"

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn() }))

vi.mock("next/navigation", () => ({
    usePathname: () => "/inventory/uoms",
    useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(nav.query),
}))
// Sin fetch real: el hook solo debe pedir el registro si su `endpoint` aplica.
const selected = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useSelectedEntity", () => ({
    useSelectedEntity: (options: { endpoint: string | null }) => {
        selected(options.endpoint)
        return { entity: options.endpoint ? { id: 5 } : null, isLoading: false, clearSelection: vi.fn() }
    },
}))

function Probe({ options }: { options?: UseEntityPanelRouteOptions }) {
    const panel = useEntityPanelRoute(options)
    return (
        <div>
            <span>{`open:${panel.open} create:${panel.isCreate} id:${panel.selectedId} tab:${panel.tab.id}`}</span>
            <button onClick={panel.close}>cerrar</button>
        </div>
    )
}

const status = () => screen.getByText(/^open:/).textContent

describe("useEntityPanelRoute", () => {
    beforeEach(() => { nav.query = ""; nav.replace.mockReset(); selected.mockReset() })

    it("stays closed without selection", () => {
        render(<Probe options={{ endpoint: "/inventory/uoms" }} />)
        expect(status()).toBe("open:false create:false id:null tab:null")
    })

    it("opens the selection once its record is loaded", () => {
        nav.query = "selected=5"
        render(<Probe options={{ endpoint: "/inventory/uoms" }} />)
        expect(status()).toBe("open:true create:false id:5 tab:5")
    })

    it("opens in creation with ?modal=new or the external flag, as a tab without id", () => {
        nav.query = "modal=new"
        const { unmount } = render(<Probe />)
        expect(status()).toBe("open:true create:true id:null tab:null")
        unmount()
        nav.query = ""
        render(<Probe options={{ external: { open: true } }} />)
        expect(status()).toBe("open:true create:true id:null tab:null")
    })

    it("does not open in creation when create is false", () => {
        nav.query = "modal=new"
        render(<Probe options={{ create: false }} />)
        expect(status()).toBe("open:false create:false id:null tab:null")
    })

    it("only answers to its own ?action values, so several panels can share ?selected", () => {
        nav.query = "selected=5&action=disburse"
        render(<><Probe options={{ actions: [null, "detail"], create: false }} /><Probe options={{ actions: ["disburse"], create: false }} /></>)
        const [view, disburse] = screen.getAllByText(/^open:/).map((el) => el.textContent)
        expect(view).toBe("open:false create:false id:null tab:null")
        expect(disburse).toBe("open:true create:false id:5 tab:5")
    })

    it("does not fetch while disabled or unresolved", () => {
        nav.query = "selected=5"
        render(<Probe options={{ endpoint: "/inventory/uoms", enabled: false }} />)
        expect(selected).toHaveBeenLastCalledWith(null)
        expect(status()).toBe("open:false create:false id:null tab:null")
    })

    it("close clears selected, action and modal, keeps other params, and notifies the external owner", () => {
        nav.query = "selected=5&action=view&modal=new&q=abc"
        const onOpenChange = vi.fn()
        render(<Probe options={{ external: { onOpenChange } }} />)
        act(() => screen.getByText("cerrar").click())
        expect(nav.replace).toHaveBeenCalledWith("/inventory/uoms?q=abc", { scroll: false })
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })
})
