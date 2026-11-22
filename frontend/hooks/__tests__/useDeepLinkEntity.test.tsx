import { render } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"

import { useDeepLinkEntity, type UseDeepLinkEntityOptions } from "../useDeepLinkEntity"

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn(), openEntity: vi.fn() }))

vi.mock("next/navigation", () => ({
    usePathname: () => "/contacts",
    useRouter: () => ({ replace: nav.replace }),
    useSearchParams: () => new URLSearchParams(nav.query),
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useOptionalGlobalModalActions: () => ({ openEntity: nav.openEntity }),
}))
vi.mock("@/lib/entity-drawers", () => ({ hasEntityDrawer: (label: string) => label === "contacts.contact" }))

function Probe({ label = "contacts.contact", options }: { label?: string; options?: UseDeepLinkEntityOptions }) {
    useDeepLinkEntity(label, options)
    return null
}

describe("useDeepLinkEntity", () => {
    beforeEach(() => { nav.query = ""; nav.replace.mockReset(); nav.openEntity.mockReset() })

    it("does nothing without ?selected", () => {
        render(<Probe />)
        expect(nav.openEntity).not.toHaveBeenCalled()
        expect(nav.replace).not.toHaveBeenCalled()
    })

    it("opens the record as a tab once and clears ?selected, keeping other params", () => {
        nav.query = "selected=7&search=ana"
        const { rerender } = render(<Probe />)
        rerender(<Probe />)
        expect(nav.openEntity).toHaveBeenCalledTimes(1)
        expect(nav.openEntity).toHaveBeenCalledWith("contacts.contact", 7)
        expect(nav.replace).toHaveBeenCalledWith("/contacts?search=ana", { scroll: false })
    })

    it("also clears ?action alongside ?selected", () => {
        nav.query = "selected=7&action=view"
        render(<Probe />)
        expect(nav.replace).toHaveBeenCalledWith("/contacts", { scroll: false })
    })

    it("leaves the URL alone when ?action belongs to another panel", () => {
        nav.query = "selected=7&action=disburse"
        render(<Probe options={{ actions: [null, "view"] }} />)
        expect(nav.openEntity).not.toHaveBeenCalled()
        expect(nav.replace).not.toHaveBeenCalled()
    })

    it("leaves the URL alone when the entity has no registered drawer", () => {
        nav.query = "selected=7"
        render(<Probe label="treasury.bank" />)
        expect(nav.openEntity).not.toHaveBeenCalled()
        expect(nav.replace).not.toHaveBeenCalled()
    })

    it("supports a custom param name", () => {
        nav.query = "selected-device=3"
        render(<Probe label="contacts.contact" options={{ selectedParam: "selected-device" }} />)
        expect(nav.openEntity).toHaveBeenCalledWith("contacts.contact", 3)
        expect(nav.replace).toHaveBeenCalledWith("/contacts", { scroll: false })
    })
})
