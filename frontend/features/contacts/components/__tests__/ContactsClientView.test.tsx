import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ContactsClientView } from "../ContactsClientView"

const m = vi.hoisted(() => ({
    openEntity: vi.fn(),
    deepLink: vi.fn(),
    panelOptions: undefined as unknown,
    rootProps: {} as Record<string, unknown>,
    actionsCtx: undefined as unknown,
}))

const ana = { id: 1, name: "Ana", is_active: true }

vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ label }: { label: string }) => <div data-testid="panel-tab">{label}</div>,
    useGlobalModals: () => ({ openEntity: m.openEntity }),
}))
vi.mock("@/hooks/useDeepLinkEntity", () => ({ useDeepLinkEntity: (label: string): void => { m.deepLink(label) } }))
vi.mock("@/hooks/useCreatePanelRoute", () => ({
    useCreatePanelRoute: (options: unknown) => {
        m.panelOptions = options
        return { tab: { id: null, open: false, onClose: vi.fn() }, close: vi.fn() }
    },
}))
vi.mock("@/features/contacts", () => ({
    useContacts: () => ({ contacts: [ana], isLoading: false, isRefetching: false, isError: false, refetch: vi.fn(), archiveContact: vi.fn() }),
}))
vi.mock("../../entity-view/contact.entity", () => ({ contactEntity: { fields: {} }, contactViews: { table: { defaultSort: undefined }, card: {} } }))
vi.mock("../ContactDrawer", () => ({ default: () => null }))
vi.mock("@/components/shared/ActionConfirmModal", () => ({ ActionConfirmModal: () => null }))
vi.mock("@/components/shared", () => ({
    LoadingFallback: () => null,
}))
vi.mock("@/components/entity-view", () => {
    const Root = ({ children, actions: _actions, ...rest }: { children: ReactNode; actions: unknown } & Record<string, unknown>) => {
        m.rootProps = rest
        return <div>{children}</div>
    }
    return {
        Collection: Object.assign(Root, { Root, Toolbar: () => null, View: () => null }),
        useCollectionQuery: () => ({ params: {}, groupBy: null, sorting: undefined, search: { isFiltered: false, clearAll: vi.fn() } }),
        useCollectionViewMode: () => ({ view: "table", onViewChange: vi.fn() }),
        useEntityCollection: () => ({}),
    }
})
vi.mock("@/features/contacts/contactActions", () => ({
    contactActions: {
        forCollection: (ctx: { onEdit: (c: typeof ana) => void }) => { m.actionsCtx = ctx; return [] },
    },
}))

describe("ContactsClientView (ADR-0152)", () => {
    beforeEach(() => { m.openEntity.mockReset(); m.deepLink.mockReset(); m.panelOptions = undefined; m.rootProps = {}; m.actionsCtx = undefined })

    it("lets the collection open rows through the default opener (one tab per contact)", () => {
        render(<ContactsClientView />)
        expect(m.rootProps.onOpen).toBeUndefined()
    })

    it("the edit action opens the contact's own tab with the row as data", async () => {
        render(<ContactsClientView />)
        ;(m.actionsCtx as { onEdit: (c: typeof ana) => void }).onEdit(ana)
        expect(m.openEntity).toHaveBeenCalledWith("contacts.contact", 1, ana)
    })

    it("treats ?selected as a deep link and keeps the page panel for creation only", () => {
        render(<ContactsClientView isNewModalOpen />)
        expect(m.deepLink).toHaveBeenCalledWith("contacts.contact")
        expect(m.panelOptions).toEqual({ external: { open: true }, resolved: false })
        expect(screen.getByTestId("panel-tab")).toHaveTextContent("contacts.contact")
    })
})
