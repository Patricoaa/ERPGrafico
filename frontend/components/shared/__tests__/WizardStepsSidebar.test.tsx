import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"
import { Package, Truck, CreditCard, Eye, Pencil } from "lucide-react"
import { WizardStepsSidebar } from "@/components/shared"

describe("WizardStepsSidebar — new rail design", () => {
    const baseSteps = [
        { id: "a", label: "Productos", icon: Package },
        { id: "b", label: "Logística", icon: Truck },
        { id: "c", label: "Pago", icon: CreditCard },
    ]

    it("renders step numbers (01, 02, 03) when showNumbers=true", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={baseSteps} showNumbers={true} />)
        expect(screen.getByText("01")).toBeInTheDocument()
        expect(screen.getByText("02")).toBeInTheDocument()
        expect(screen.getByText("03")).toBeInTheDocument()
    })

    it("renders icons instead of numbers when showNumbers=false", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} showNumbers={false} />)
        // Icons are present (no text numbers)
        expect(screen.queryByText("01")).not.toBeInTheDocument()
    })

    it("shows detail on active step when detailVisibility='both'", async () => {
        const stepsWithDetail = [
            { ...baseSteps[0], detail: <span>Detalle paso 1</span> },
            { ...baseSteps[1], detail: <span>Detalle paso 2</span> },
            baseSteps[2],
        ]
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={stepsWithDetail} detailVisibility="both" />)
        expect(screen.getByText("Detalle paso 2")).toBeInTheDocument() // active step
        expect(screen.getByText("Detalle paso 1")).toBeInTheDocument() // past step
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

    it("hides counter when showCounter=false", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} showCounter={false} />)
        expect(screen.queryByText("01 / 03")).not.toBeInTheDocument()
    })

    it("applies aria-current='step' to the active step row", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={2} steps={baseSteps} />)
        const activeButton = screen.getByText("02").closest("button")
        expect(activeButton).toHaveAttribute("aria-current", "step")
    })

    it("disables future steps (aria-disabled and disabled attr)", async () => {
        const onStepClick = vi.fn()
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} onStepClick={onStepClick} />)
        // Step 2 (future) should be disabled
        const futureButton = screen.getByText("02").closest("button")
        expect(futureButton).not.toBeNull()
        if (futureButton) {
            expect(futureButton).toBeDisabled()
            expect(futureButton).toHaveAttribute("aria-disabled", "true")
            // Clicking it should not call onStepClick
            await futureButton.click()
        }
        expect(onStepClick).not.toHaveBeenCalled()
    })

    it("calls onStepClick with 0-based index when a past/active step is clicked", async () => {
        const onStepClick = vi.fn()
        render(<WizardStepsSidebar title="Proceso" currentStep={3} steps={baseSteps} onStepClick={onStepClick} />)
        // Click step 1 (past)
        const step1Button = screen.getByText("01").closest("button")
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
            />
        )
        // The stretched link button + 3 action buttons = 4 buttons
        expect(screen.getAllByRole("button")).toHaveLength(4)
        // Action buttons have their own aria-label
        expect(screen.getByTestId("action-0")).toBeInTheDocument()
        expect(screen.getByTestId("action-1")).toBeInTheDocument()
        expect(screen.getByTestId("action-2")).toBeInTheDocument()
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
        // Current step should have the 'current' styling (border-primary/20, bg-accent/20)
        const currentRow = screen.getByText("Logística").closest("[role='listitem']")
        expect(currentRow).toHaveClass("border-primary/20")
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

    it("vertical connector line is present", async () => {
        render(<WizardStepsSidebar title="Proceso" currentStep={1} steps={baseSteps} />)
        const connector = screen.getByTestId("step-connector")
        // The connector is a div with gradient - we check for its presence via the gradient class
        // Since it's aria-hidden, we use the container query
        const rail = screen.getByRole("list").parentElement
        expect(rail?.querySelector("[style*='bg-gradient-to-b']")).toBeInTheDocument()
    })
})