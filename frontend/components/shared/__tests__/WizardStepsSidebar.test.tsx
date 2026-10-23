import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { Package, Truck, CreditCard } from "lucide-react"
import { WizardStepsSidebar } from "@/components/shared"

describe("WizardStepsSidebar — status board rail", () => {
    const baseSteps = [
        { id: "a", label: "Productos", icon: Package },
        { id: "b", label: "Logística", icon: Truck },
        { id: "c", label: "Pago", icon: CreditCard },
    ]

    it("renders checkmarks on past steps and numbers on active/future steps", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={baseSteps} showNumbers={true} />)
        expect(screen.getByTestId("step-0").querySelector("svg")).toBeInTheDocument()
        expect(screen.getByTestId("step-1").textContent).toContain("02")
        expect(screen.getByTestId("step-2").textContent).toContain("03")
    })

    it("renders icons instead of numbers when showNumbers=false", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} showNumbers={false} />)
        expect(screen.getByTestId("step-0").querySelector("svg")).toBeInTheDocument()
        expect(screen.queryByText("02")).not.toBeInTheDocument()
    })

    it("shows detail on active step when detailVisibility='both'", async () => {
        const stepsWithDetail = [
            { ...baseSteps[0], detail: <span>Detalle paso 1</span> },
            { ...baseSteps[1], detail: <span>Detalle paso 2</span> },
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={stepsWithDetail} detailVisibility="both" />)
        expect(screen.getByText("Detalle paso 2")).toBeInTheDocument()
        expect(screen.getByText("Detalle paso 1")).toBeInTheDocument()
    })

    it("shows detail only on active step when detailVisibility='active'", async () => {
        const stepsWithDetail = [
            { ...baseSteps[0], detail: <span>Detalle paso 1</span> },
            { ...baseSteps[1], detail: <span>Detalle paso 2</span> },
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={stepsWithDetail} detailVisibility="active" />)
        expect(screen.getByText("Detalle paso 2")).toBeInTheDocument()
        expect(screen.queryByText("Detalle paso 1")).not.toBeInTheDocument()
    })

    it("shows detail only on past steps when detailVisibility='past'", async () => {
        const stepsWithDetail = [
            { ...baseSteps[0], detail: <span>Detalle paso 1</span> },
            { ...baseSteps[1], detail: <span>Detalle paso 2</span> },
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={stepsWithDetail} detailVisibility="past" />)
        expect(screen.getByText("Detalle paso 1")).toBeInTheDocument()
        expect(screen.queryByText("Detalle paso 2")).not.toBeInTheDocument()
    })

    it("hides detail when detailVisibility='none'", async () => {
        const stepsWithDetail = [
            { ...baseSteps[0], detail: <span>Detalle paso 1</span> },
            { ...baseSteps[1], detail: <span>Detalle paso 2</span> },
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={stepsWithDetail} detailVisibility="none" />)
        expect(screen.queryByText("Detalle paso 1")).not.toBeInTheDocument()
        expect(screen.queryByText("Detalle paso 2")).not.toBeInTheDocument()
    })

    it("shows counter '01 / 03' in header when showCounter=true", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} showCounter={true} />)
        expect(screen.getByText("01 / 03")).toBeInTheDocument()
    })

    it("prefixes the counter with counterLabel when provided", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={2}
                steps={baseSteps}
                showCounter={true}
                counterLabel="Viendo"
            />,
        )
        expect(screen.getByText("Viendo 02 / 03")).toBeInTheDocument()
    })

    it("hides counter when showCounter=false", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} showCounter={false} />)
        expect(screen.queryByText("01 / 03")).not.toBeInTheDocument()
    })

    it("applies aria-current='step' to the active step row", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={baseSteps} />)
        const activeButton = screen.getByTestId("step-1").querySelector("button")
        expect(activeButton).toHaveAttribute("aria-current", "step")
    })

    it("disables future steps and does not call onStepClick", async () => {
        const onStepClick = vi.fn()
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} onStepClick={onStepClick} />)
        const futureButton = screen.getByTestId("step-1").querySelector("button")
        expect(futureButton).not.toBeNull()
        if (futureButton) {
            expect(futureButton).toBeDisabled()
            expect(futureButton).toHaveAttribute("aria-disabled", "true")
            await futureButton.click()
        }
        expect(onStepClick).not.toHaveBeenCalled()
    })

    it("calls onStepClick with 0-based index when a past/active step is clicked", async () => {
        const onStepClick = vi.fn()
        render(<WizardStepsSidebar title="Proceso" currentStep={3} steps={baseSteps} onStepClick={onStepClick} />)
        const step1Button = screen.getByTestId("step-0").querySelector("button")
        expect(step1Button).not.toBeNull()
        if (step1Button) {
            await step1Button.click()
        }
        expect(onStepClick).toHaveBeenCalledWith(0)
    })

    it("renders renderStepActions in hover-reveal column (outside the stretched link button)", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={1}
                steps={baseSteps}
                renderStepActions={(step, index) => (
                    <button aria-label={`action-${index}`} data-testid={`action-${index}`}>
                        x
                    </button>
                )}
            />,
        )
        // 3 stretched link buttons (one per step) + 3 action buttons = 6 buttons
        expect(screen.getAllByRole("button")).toHaveLength(6)
        expect(screen.getByTestId("action-0")).toBeInTheDocument()
        expect(screen.getByTestId("action-1")).toBeInTheDocument()
        expect(screen.getByTestId("action-2")).toBeInTheDocument()
    })

    it("reveals actions on hover, focus-within and coarse pointers", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={1}
                steps={baseSteps}
                renderStepActions={(step, index) => (
                    <button aria-label={`action-${index}`}>x</button>
                )}
            />,
        )
        const actions = screen.getAllByTestId("step-actions")[0]
        expect(actions.className).toContain("opacity-0")
        expect(actions.className).toContain("group-hover:opacity-100")
        expect(actions.className).toContain("group-focus-within:opacity-100")
        expect(actions.className).toContain("pointer-coarse:opacity-100")
        expect(actions.className).not.toContain("hidden")
    })

    it("renders badge on step when provided", async () => {
        const stepsWithBadge = [
            { ...baseSteps[0], badge: <span className="bg-primary/10 text-primary text-3xs px-1 rounded">nuevo</span> },
            baseSteps[1],
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={stepsWithBadge} />)
        expect(screen.getByText("nuevo")).toBeInTheDocument()
    })

    it("renders explicit status 'current' differently from 'active'", async () => {
        const stepsWithCurrent = [
            { ...baseSteps[0], status: "past" as const },
            { ...baseSteps[1], status: "current" as const },
            { ...baseSteps[2], status: "future" as const },
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={stepsWithCurrent} />)
        const currentRow = screen.getByText("Logística").closest("[role='listitem']")
        expect(currentRow).toHaveClass("border-primary/20")
    })

    it("renders group labels only before the first step of each group", async () => {
        const groupedSteps = [
            { ...baseSteps[0], group: "Preparación" },
            { ...baseSteps[1], group: "Preparación" },
            { ...baseSteps[2], group: "Cierre" },
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={groupedSteps} />)
        expect(screen.getAllByText("Preparación")).toHaveLength(1)
        expect(screen.getAllByText("Cierre")).toHaveLength(1)
    })

    it("renders a blocker warning icon with title and includes it in the row label", async () => {
        const stepsWithWarning = [
            { ...baseSteps[0], warning: "2 materiales sin stock" },
            baseSteps[1],
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={stepsWithWarning} />)
        expect(screen.getByTitle("2 materiales sin stock")).toBeInTheDocument()
        expect(screen.getByTestId("step-0").querySelector("button")).toHaveAttribute(
            "aria-label",
            expect.stringContaining("atención: 2 materiales sin stock"),
        )
    })

    it("renders a progress bar and progress-aware connector", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={2}
                steps={baseSteps}
                progressPercent={67}
            />,
        )
        expect(screen.getByTestId("rail-progress")).toHaveAttribute("aria-valuenow", "67")
        expect(screen.getByText("67%")).toBeInTheDocument()
        expect(screen.getByTestId("step-connector-fill")).toHaveStyle({ height: "67%" })
    })

    it("clamps progress above 100", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={3}
                steps={baseSteps}
                progressPercent={140}
            />,
        )
        expect(screen.getByTestId("rail-progress")).toHaveAttribute("aria-valuenow", "100")
    })

    it("applies compact density classes by default", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} density="compact" />)
        const row = screen.getByText("Productos").closest("[role='listitem']")
        expect(row).toHaveClass("py-1.5")
        expect(row).toHaveClass("px-2")
    })

    it("applies comfortable density classes when specified", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} density="comfortable" />)
        const row = screen.getByText("Productos").closest("[role='listitem']")
        expect(row).toHaveClass("py-2.5")
        expect(row).toHaveClass("px-3")
    })

    it("renders a sticky header with the connector line in the rail", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} />)
        expect(screen.getByTestId("step-connector").className).toContain("bg-gradient-to-b")
        const header = screen.getByText("Proceso").closest("[data-rail-header]")
        expect(header).toHaveClass("sticky")
    })

    it("links the step button to its detail for screen readers", async () => {
        const stepsWithDetail = [
            { ...baseSteps[0], detail: "Detalle accesible" },
            baseSteps[1],
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={stepsWithDetail} />)
        const button = screen.getByTestId("step-0").querySelector("button")
        const detailId = button?.getAttribute("aria-describedby")
        expect(detailId).toBeTruthy()
        expect(document.getElementById(detailId ?? "")).toHaveTextContent("Detalle accesible")
    })

    it("exposes a collapse control in expanded mode", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={1}
                steps={baseSteps}
                onToggleCollapsed={vi.fn()}
            />,
        )
        const toggle = screen.getByRole("button", { name: "Colapsar etapas" })
        expect(toggle).toHaveAttribute("aria-expanded", "true")
    })

    it("collapses to icon-only mode", async () => {
        const groupedSteps = [
            { ...baseSteps[0], group: "Preparación", detail: "Detalle visible" },
            { ...baseSteps[1], group: "Preparación" },
            { ...baseSteps[2], group: "Cierre" },
        ]
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={2}
                steps={groupedSteps}
                collapsed
                onToggleCollapsed={vi.fn()}
                progressPercent={67}
            />,
        )

        // Labels, details, groups, progress bar and counter are gone.
        expect(screen.queryByText("Productos")).not.toBeInTheDocument()
        expect(screen.queryByText("Detalle visible")).not.toBeInTheDocument()
        expect(screen.queryByText("Preparación")).not.toBeInTheDocument()
        expect(screen.queryByTestId("rail-progress")).not.toBeInTheDocument()
        expect(screen.queryByText("67%")).not.toBeInTheDocument()

        // Rows remain, and the native title carries the label.
        expect(screen.getByTestId("step-0")).toBeInTheDocument()
        expect(screen.getByTestId("step-0").querySelector("button")).toHaveAttribute(
            "title",
            expect.stringContaining("Productos"),
        )

        // The rail is narrow and the connector is centered.
        const root = screen.getByRole("list").closest("[data-collapsed]")
        expect(root).toHaveClass("w-14")
        expect(screen.getByTestId("step-connector").className).toContain("left-[27px]")

        const toggle = screen.getByRole("button", { name: "Expandir etapas" })
        expect(toggle).toHaveAttribute("aria-expanded", "false")
    })

    it("hides step actions when collapsed", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={1}
                steps={baseSteps}
                collapsed
                onToggleCollapsed={vi.fn()}
                renderStepActions={() => <button aria-label="action">x</button>}
            />,
        )
        expect(screen.queryByRole("button", { name: "action" })).not.toBeInTheDocument()
    })

    it("renders an optional header note", async () => {
        render(
            <WizardStepsSidebar
                title="Proceso"
                currentStep={1}
                steps={baseSteps}
                headerNote={<span>Orden cancelada · solo lectura</span>}
            />,
        )
        expect(screen.getByText("Orden cancelada · solo lectura")).toBeInTheDocument()
    })
})
