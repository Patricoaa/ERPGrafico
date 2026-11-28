import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { CollapsibleSheet } from "@/components/shared"
import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"

vi.mock("next/navigation", () => ({ usePathname: () => "/sales", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))

function Panel({ fullViewport }: { fullViewport: boolean }) {
    return (
        <GlobalModalProvider>
            <CollapsibleSheet sheetId="t" open onOpenChange={() => {}} tabLabel="Panel" tabIcon={Inbox} side="right" fullViewport={fullViewport} blockingOverlay registerInStack={false}>
                contenido
            </CollapsibleSheet>
        </GlobalModalProvider>
    )
}

describe("CollapsibleSheet junto al riel de herramientas", () => {
    it("un panel derecho a pantalla completa termina donde empieza el riel", async () => {
        render(<Panel fullViewport />)
        const panel = await screen.findByRole("dialog", { name: "Panel" })
        expect(panel.style.right).toBe("calc(var(--tool-rail-width, 0px) + 0px)")
    })

    it("un panel bajo la barra de trabajo no cambia su anclaje", async () => {
        render(<Panel fullViewport={false} />)
        const panel = await screen.findByRole("dialog", { name: "Panel" })
        expect(panel.style.right).toBe("0px")
    })
})
