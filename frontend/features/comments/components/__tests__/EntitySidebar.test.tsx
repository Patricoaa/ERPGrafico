import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EntitySidebar } from "../EntitySidebar"

vi.mock("@/features/audit", () => ({
    ActivitySidebar: ({ entityType, defaultOpen }: { entityType: string; defaultOpen?: boolean }) => (
        <aside>actividad {entityType} {defaultOpen ? "abierta" : "cerrada"}</aside>
    ),
}))
vi.mock("../CommentsPanel", () => ({
    CommentsPanel: ({ target }: { target: { label: string; id: number | string } }) => (
        <section>comentarios {target.label}:{target.id}</section>
    ),
}))

describe("EntitySidebar", () => {
    it("stacks comments above activity for commentable entity types", () => {
        render(<EntitySidebar entityType="contact" entityId={17} />)
        expect(screen.getByText("comentarios contacts.contact:17")).toBeInTheDocument()
        expect(screen.getByText("actividad contact cerrada")).toBeInTheDocument()
    })

    it("shows activity only when the key has no commentable model", () => {
        render(<EntitySidebar entityType="company_settings" entityId={1} />)
        expect(screen.queryByText(/comentarios/)).not.toBeInTheDocument()
        expect(screen.getByText("actividad company_settings abierta")).toBeInTheDocument()
    })
})
