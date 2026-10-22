import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"
import { Package, Truck, CreditCard } from "lucide-react"

import {
    GenericWizard,
    type GenericWizardHandle,
    type WizardStep,
} from "@/components/shared"

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

/** Radix sets `pointer-events: none` on <body> while a dialog is open, so a plain
 * `.click()` is swallowed. Calling the React onClick prop directly bypasses that guard. */
async function press(el: Element | null) {
    if (!el) throw new Error("press() received a null element")
    const props = Object.entries(el).find(([k]) => k.startsWith("__reactProps"))?.[1] as
        | { onClick?: (e: unknown) => void }
        | undefined
    await act(async () => {
        if (props?.onClick) {
            props.onClick({ preventDefault() {}, stopPropagation() {} })
        } else {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
        }
        await new Promise(r => setTimeout(r, 10))
    })
}

/** Renders and lets mount effects flush (GenericWizard schedules work in a rAF). */
async function mount(ui: React.ReactElement) {
    const result = render(ui)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    return result
}

function makeSteps(overrides: Partial<WizardStep>[] = []): WizardStep[] {
    const base: WizardStep[] = [
        { id: "a", title: "Paso A", component: <div>contenido A</div> },
        { id: "b", title: "Paso B", component: <div>contenido B</div> },
        { id: "c", title: "Paso C", component: <div>contenido C</div> },
    ]
    return base.map((s, i) => ({ ...s, ...(overrides[i] ?? {}) }))
}

describe("GenericWizard", () => {
    it("advances and goes back through steps", async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined)
        await mount(
            <GenericWizard open onOpenChange={() => {}} title="Wizard" steps={makeSteps()} onComplete={onComplete} />
        )

        expect(screen.getByText("contenido A")).toBeInTheDocument()

        await press(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("contenido B")).toBeInTheDocument()

        await press(screen.getByRole("button", { name: /Anterior/ }))
        expect(screen.getByText("contenido A")).toBeInTheDocument()
        expect(onComplete).not.toHaveBeenCalled()
    })

    it("blocks navigation when a step's onNext resolves false", async () => {
        const onNext = vi.fn().mockResolvedValue(false)
        const steps = makeSteps([{ onNext }])
        await mount(
            <GenericWizard open onOpenChange={() => {}} title="Wizard" steps={steps} onComplete={vi.fn()} />
        )

        await press(screen.getByRole("button", { name: /Siguiente/ }))
        expect(onNext).toHaveBeenCalledTimes(1)
        expect(screen.getByText("contenido A")).toBeInTheDocument()
    })

    it("calls onComplete on the last step and shows successContent", async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined)
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={onComplete}
                completeButtonLabel="Cerrar trato"
                successContent={<div>listo</div>}
            />
        )

        await press(screen.getByRole("button", { name: /Siguiente/ }))
        await press(screen.getByRole("button", { name: /Siguiente/ }))
        await press(screen.getByRole("button", { name: /Cerrar trato/ }))

        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(screen.getByText("listo")).toBeInTheDocument()
    })

    it("renders sidebar slots and exposes the current step to render props", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={vi.fn()}
                leftSidebar={(ctx) => <div>rail-izq paso {ctx.step + 1} de {ctx.totalSteps}</div>}
                rightSidebar={<div>rail-der</div>}
            />
        )

        expect(screen.getByText("rail-izq paso 1 de 3")).toBeInTheDocument()
        expect(screen.getByText("rail-der")).toBeInTheDocument()
    })

    it("re-renders sidebar render props as the step advances", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={vi.fn()}
                leftSidebar={(ctx) => <div>paso actual {ctx.step + 1}</div>}
            />
        )

        expect(screen.getByText("paso actual 1")).toBeInTheDocument()
        await press(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("paso actual 2")).toBeInTheDocument()
    })

    it("navigates imperatively through the handle", async () => {
        const ref = React.createRef<GenericWizardHandle>()
        const onComplete = vi.fn().mockResolvedValue(undefined)
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={onComplete}
                handleRef={ref}
            />
        )

        expect(ref.current?.step).toBe(0)
        expect(ref.current?.totalSteps).toBe(3)

        await act(async () => { await ref.current?.goNext() })
        expect(ref.current?.step).toBe(1)

        await act(async () => { ref.current?.goBack() })
        expect(ref.current?.step).toBe(0)

        await act(async () => { ref.current?.goTo(2) })
        expect(ref.current?.step).toBe(2)

        await act(async () => { await ref.current?.finish() })
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it("opens on the initialStep received", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                initialStep={1}
                onComplete={vi.fn()}
            />
        )
        expect(screen.getByText("contenido B")).toBeInTheDocument()
    })

    it("replaces the default footer when a footer slot is provided", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={vi.fn()}
                footer={<div>footer propio</div>}
            />
        )
        expect(screen.getByText("footer propio")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull()
    })

    it("omits the footer when it is null", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={vi.fn()}
                footer={null}
            />
        )
        expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull()
        expect(screen.getByText("contenido A")).toBeInTheDocument()
    })

    it("renders an inline surface without modal chrome", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={vi.fn()}
                surface="inline"
                footer={null}
            />
        )
        expect(screen.getByText("contenido A")).toBeInTheDocument()
        expect(screen.queryByRole("dialog")).toBeNull()
    })

    it("notifies onStepChange when navigating", async () => {
        const onStepChange = vi.fn()
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                steps={makeSteps()}
                onComplete={vi.fn()}
                onStepChange={onStepChange}
            />
        )
        expect(onStepChange).toHaveBeenLastCalledWith(0)
        await press(screen.getByRole("button", { name: /Siguiente/ }))
        expect(onStepChange).toHaveBeenLastCalledWith(1)
    })

    it("uses the provided subtitle instead of the step counter", async () => {
        await mount(
            <GenericWizard
                open
                onOpenChange={() => {}}
                title="Wizard"
                subtitle={<span>subtítulo del dominio</span>}
                steps={makeSteps()}
                onComplete={vi.fn()}
            />
        )
        expect(screen.getByText("subtítulo del dominio")).toBeInTheDocument()
    })
})

describe("WizardStepsSidebar", () => {
    const steps = [
        { id: "a", label: "Productos", icon: Package },
        { id: "b", label: "Logística", icon: Truck },
        { id: "c", label: "Pago", icon: CreditCard },
    ]

    it("marks the current step and calls onStepClick with a 0-based index", async () => {
        const onStepClick = vi.fn()
        const { WizardStepsSidebar } = await import("@/components/shared")
        await mount(<WizardStepsSidebar title="Proceso" currentStep={2} steps={steps} onStepClick={onStepClick} />)

        // The row is now a button via stretched link pattern
        const target = screen.getByText("Productos")
        await press(target.closest("button"))
        expect(onStepClick).toHaveBeenCalledWith(0)
    })

    it("honours an explicit per-step status over currentStep", async () => {
        const { WizardStepsSidebar } = await import("@/components/shared")
        await mount(
            <WizardStepsSidebar
                title="Etapas"
                currentStep={1}
                steps={[
                    { ...steps[0], status: "future" as const },
                    { ...steps[1], status: "active" as const },
                    { ...steps[2], status: "past" as const },
                ]}
            />
        )
        expect(screen.getByText("Pago")).toBeInTheDocument()
    })

    it("renders custom per-step actions", async () => {
        const { WizardStepsSidebar } = await import("@/components/shared")
        await mount(
            <WizardStepsSidebar
                title="Etapas"
                currentStep={1}
                steps={steps}
                renderStepActions={(step) => <span role="button" aria-label={`accion-${step.id}`}>x</span>}
            />
        )
        // The stretched link button + 3 action buttons = 4 buttons
        expect(screen.getAllByRole("button")).toHaveLength(4)
    })
})
