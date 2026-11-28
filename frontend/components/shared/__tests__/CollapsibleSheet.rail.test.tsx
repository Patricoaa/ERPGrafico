import { Button } from "@/components/ui/button"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

    it("a pantalla completa el ancho nunca supera el viewport menos el riel", async () => {
        render(
            <GlobalModalProvider>
                <CollapsibleSheet sheetId="w" open onOpenChange={() => {}} tabLabel="Ancho" tabIcon={Inbox} side="right" fullViewport fullWidth={900} blockingOverlay registerInStack={false}>
                    contenido
                </CollapsibleSheet>
            </GlobalModalProvider>
        )
        const panel = await screen.findByRole("dialog", { name: "Ancho" })
        expect(panel.style.maxWidth).toBe("min(900px, calc(100vw - var(--tool-rail-width, 0px)))")
    })

    it("un panel bajo la barra de trabajo no cambia su anclaje", async () => {
        render(<Panel fullViewport={false} />)
        const panel = await screen.findByRole("dialog", { name: "Panel" })
        expect(panel.style.right).toBe("0px")
    })

    describe("clics en el riel con un overlay bloqueante abierto", () => {
        function Blocking({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
            return (
                <GlobalModalProvider>
                    <div data-tool-rail><Button type="button">riel</Button></div>
                    <Button type="button">afuera</Button>
                    <CollapsibleSheet sheetId="b" open onOpenChange={onOpenChange} tabLabel="Panel" tabIcon={Inbox} side="right" fullViewport blockingOverlay registerInStack={false}>
                        contenido
                    </CollapsibleSheet>
                </GlobalModalProvider>
            )
        }

        it("no cierran el panel: el riel decide (alternar o cambiar de herramienta)", async () => {
            const onOpenChange = vi.fn()
            render(<Blocking onOpenChange={onOpenChange} />)
            await screen.findByRole("dialog", { name: "Panel" })
            // body queda con pointer-events:none bajo un modal de Radix; el riel lo reactiva con pointer-events-auto
            const user = userEvent.setup({ pointerEventsCheck: 0 })
            await user.click(screen.getByText("riel"))
            expect(onOpenChange).not.toHaveBeenCalledWith(false)
        })

        it("un clic fuera del riel y del panel sí lo cierra", async () => {
            const onOpenChange = vi.fn()
            render(<Blocking onOpenChange={onOpenChange} />)
            await screen.findByRole("dialog", { name: "Panel" })
            const user = userEvent.setup({ pointerEventsCheck: 0 })
            await user.click(screen.getByText("afuera"))
            expect(onOpenChange).toHaveBeenCalledWith(false)
        })
    })
})
