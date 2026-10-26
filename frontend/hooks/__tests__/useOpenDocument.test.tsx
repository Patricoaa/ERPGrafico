import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import React from "react"

import { useOpenDocument, canOpenDocument, opensInApp } from "../useOpenDocument"
import { DRILLDOWN_STACK_STORAGE_KEY } from "@/lib/documentNavigation"
import { SourceDocumentLink } from "@/components/shared"

const { openEntityMock, pushMock } = vi.hoisted(() => ({ openEntityMock: vi.fn(), pushMock: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: openEntityMock }),
}))
vi.mock("@/lib/entity-drawers", () => ({
    hasEntityDrawer: (label: string) => label !== "tax.taxperiod",
}))

const LIST_URL = "/billing/invoices?selected=9"

function Opener({ label, url }: { label: string; url?: string | null }) {
    const open = useOpenDocument()
    return <button onClick={() => open({ label, id: 9, display: "FAC-9", url })}>abrir</button>
}

const click = (name: string) => act(() => screen.getByText(name).click())
const enableStack = () => window.localStorage.setItem(DRILLDOWN_STACK_STORAGE_KEY, "1")

describe("useOpenDocument", () => {
    beforeEach(() => { openEntityMock.mockReset(); pushMock.mockReset(); window.localStorage.clear() })
    afterEach(() => { window.localStorage.clear() })

    describe("flag off (ADR-0086, legacy)", () => {
        it("navigates when the canonical url is a list selection", () => {
            render(<Opener label="billing.invoice" url={LIST_URL} />)
            click("abrir")
            expect(pushMock).toHaveBeenCalledWith(LIST_URL, { scroll: false })
            expect(openEntityMock).not.toHaveBeenCalled()
        })

        it("stacks when there is no list url", () => {
            render(<Opener label="contacts.contact" url="/d/contacts.contact/9" />)
            click("abrir")
            expect(openEntityMock).toHaveBeenCalledWith("contacts.contact", 9, undefined, undefined, { display: "FAC-9" })
            expect(pushMock).not.toHaveBeenCalled()
        })
    })

    describe("flag on (ADR-0100)", () => {
        beforeEach(enableStack)

        it("stacks a document that has a list url instead of navigating", () => {
            render(<Opener label="billing.invoice" url={LIST_URL} />)
            click("abrir")
            expect(openEntityMock).toHaveBeenCalledWith("billing.invoice", 9, undefined, undefined, { display: "FAC-9" })
            expect(pushMock).not.toHaveBeenCalled()
        })

        it("falls back to the url when no drawer is registered", () => {
            render(<Opener label="tax.taxperiod" url="/tax/periods?selected=9" />)
            click("abrir")
            expect(pushMock).toHaveBeenCalledWith("/tax/periods?selected=9")
            expect(openEntityMock).not.toHaveBeenCalled()
        })

        it("does nothing without a drawer or a url", () => {
            render(<Opener label="tax.taxperiod" url={null} />)
            click("abrir")
            expect(pushMock).not.toHaveBeenCalled()
            expect(openEntityMock).not.toHaveBeenCalled()
        })
    })

    it("canOpenDocument / opensInApp reflect the registry and the flag", () => {
        expect(canOpenDocument({ label: "billing.invoice" })).toBe(true)
        expect(canOpenDocument({ label: "tax.taxperiod", url: "#" })).toBe(false)
        expect(canOpenDocument({ label: "tax.taxperiod", url: "/x" })).toBe(true)
        expect(opensInApp({ label: "tax.taxperiod", url: "/tax/periods?selected=1" })).toBe(true)
        enableStack()
        expect(opensInApp({ label: "tax.taxperiod", url: "/tax/periods?selected=1" })).toBe(false)
    })
})

describe("SourceDocumentLink through useOpenDocument", () => {
    beforeEach(() => { openEntityMock.mockReset(); pushMock.mockReset(); window.localStorage.clear() })

    it("stops propagation and stacks with the flag on", () => {
        enableStack()
        const rowClick = vi.fn()
        render(
            <div onClick={rowClick}>
                <SourceDocumentLink doc={{ type: "billing.invoice", id: 9, display: "FAC-9", url: LIST_URL }} />
            </div>,
        )
        click("FAC-9")
        expect(openEntityMock).toHaveBeenCalledWith("billing.invoice", 9, undefined, undefined, { display: "FAC-9" })
        expect(pushMock).not.toHaveBeenCalled()
        expect(rowClick).not.toHaveBeenCalled()
    })

    it("keeps navigating with the flag off", () => {
        render(<SourceDocumentLink doc={{ type: "billing.invoice", id: 9, display: "FAC-9", url: LIST_URL }} />)
        click("FAC-9")
        expect(pushMock).toHaveBeenCalledWith(LIST_URL, { scroll: false })
    })
})
