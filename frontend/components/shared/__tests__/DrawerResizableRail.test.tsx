import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { DrawerResizableRail } from "../DrawerResizableRail"

describe("DrawerResizableRail", () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.clearAllMocks()
    })

    it("renders children in expanded state by default", () => {
        render(
            <DrawerResizableRail side="left">
                <div>Expanded Content</div>
            </DrawerResizableRail>
        )

        expect(screen.getByText("Expanded Content")).toBeInTheDocument()
        const aside = screen.getByTestId("drawer-resizable-rail-left")
        expect(aside).toHaveAttribute("data-state", "expanded")
        expect(aside).toHaveStyle({ width: "256px" })
    })

    it("renders collapsedContent when collapsed is true", () => {
        render(
            <DrawerResizableRail
                side="left"
                collapsed={true}
                collapsedContent={<div>Compact Content</div>}
            >
                <div>Expanded Content</div>
            </DrawerResizableRail>
        )

        expect(screen.getByText("Compact Content")).toBeInTheDocument()
        expect(screen.queryByText("Expanded Content")).not.toBeInTheDocument()
        const aside = screen.getByTestId("drawer-resizable-rail-left")
        expect(aside).toHaveAttribute("data-state", "collapsed")
        expect(aside).toHaveStyle({ width: "56px" })
    })

    it("toggles collapse state on double-click of the resize handle", () => {
        const onToggle = vi.fn()
        render(
            <DrawerResizableRail
                side="left"
                onToggleCollapsed={onToggle}
                collapsedContent={<div>Compact</div>}
            >
                <div>Expanded</div>
            </DrawerResizableRail>
        )

        const separator = screen.getByRole("separator")
        expect(screen.getByText("Expanded")).toBeInTheDocument()

        // Double click to collapse
        fireEvent.doubleClick(separator)
        expect(screen.getByText("Compact")).toBeInTheDocument()
        expect(onToggle).toHaveBeenCalledTimes(1)

        // Double click to expand
        fireEvent.doubleClick(separator)
        expect(screen.getByText("Expanded")).toBeInTheDocument()
        expect(onToggle).toHaveBeenCalledTimes(2)
    })

    it("toggles collapse via Enter or Space key on the separator", () => {
        const onToggle = vi.fn()
        render(
            <DrawerResizableRail
                side="right"
                onToggleCollapsed={onToggle}
                collapsedContent={<div>Compact</div>}
            >
                <div>Expanded</div>
            </DrawerResizableRail>
        )

        const separator = screen.getByRole("separator")

        // Press Enter
        fireEvent.keyDown(separator, { key: "Enter" })
        expect(screen.getByText("Compact")).toBeInTheDocument()
        expect(onToggle).toHaveBeenCalledTimes(1)

        // Press Space
        fireEvent.keyDown(separator, { key: " " })
        expect(screen.getByText("Expanded")).toBeInTheDocument()
        expect(onToggle).toHaveBeenCalledTimes(2)
    })

    it("resizes with pointer events and clamps between minWidth and maxWidth", () => {
        render(
            <DrawerResizableRail
                side="left"
                defaultWidth={250}
                minWidth={200}
                maxWidth={400}
            >
                <div>Content</div>
            </DrawerResizableRail>
        )

        const separator = screen.getByRole("separator")
        const aside = screen.getByTestId("drawer-resizable-rail-left")

        // Start drag at x=250
        fireEvent.pointerDown(separator, { clientX: 250, button: 0 })

        // Move to x=350 (expand by +100px -> 350px)
        fireEvent.pointerMove(separator, { clientX: 350 })
        expect(aside).toHaveStyle({ width: "350px" })

        // Move beyond maxWidth (x=600 -> should clamp to 400px)
        fireEvent.pointerMove(separator, { clientX: 600 })
        expect(aside).toHaveStyle({ width: "400px" })

        // Move below minWidth but above collapseThreshold (x=210 -> 210px)
        fireEvent.pointerMove(separator, { clientX: 210 })
        expect(aside).toHaveStyle({ width: "210px" })

        // Release pointer
        fireEvent.pointerUp(separator)
        expect(aside).toHaveStyle({ width: "210px" })
    })

    it("snaps to collapsed when dragged below collapseThreshold", () => {
        const onToggle = vi.fn()
        render(
            <DrawerResizableRail
                side="left"
                defaultWidth={250}
                minWidth={200}
                collapseThreshold={140}
                onToggleCollapsed={onToggle}
                collapsedContent={<div>Icons Only</div>}
            >
                <div>Full Labels</div>
            </DrawerResizableRail>
        )

        const separator = screen.getByRole("separator")
        const aside = screen.getByTestId("drawer-resizable-rail-left")

        // Start drag at x=250
        fireEvent.pointerDown(separator, { clientX: 250, button: 0 })

        // Drag to x=100 (delta = -150 -> rawWidth = 100 <= 140 threshold)
        fireEvent.pointerMove(separator, { clientX: 100 })
        expect(screen.getByText("Icons Only")).toBeInTheDocument()
        expect(aside).toHaveAttribute("data-state", "collapsed")
        expect(onToggle).toHaveBeenCalled()

        fireEvent.pointerUp(separator)
    })

    it("expands from collapsed state when dragged past expandThreshold", () => {
        const onToggle = vi.fn()
        render(
            <DrawerResizableRail
                side="left"
                defaultCollapsed={true}
                compactWidth={56}
                defaultWidth={250}
                minWidth={200}
                collapseThreshold={140}
                expandThreshold={180}
                onToggleCollapsed={onToggle}
                collapsedContent={<div>Icons Only</div>}
            >
                <div>Full Labels</div>
            </DrawerResizableRail>
        )

        const separator = screen.getByRole("separator")
        expect(screen.getByText("Icons Only")).toBeInTheDocument()

        // Drag outward from compact (dragStartWidth = 56)
        fireEvent.pointerDown(separator, { clientX: 56, button: 0 })

        // Drag to x=220 (delta = +164 -> rawWidth = 220 >= 180 expandThreshold)
        fireEvent.pointerMove(separator, { clientX: 220 })
        expect(screen.getByText("Full Labels")).toBeInTheDocument()

        fireEvent.pointerUp(separator)
    })

    it("persists width and collapsed state to localStorage", () => {
        const storageKey = "test.resizable.rail"
        render(
            <DrawerResizableRail
                side="right"
                storageKey={storageKey}
                defaultWidth={300}
                minWidth={240}
                maxWidth={450}
            >
                <div>Right Content</div>
            </DrawerResizableRail>
        )

        const separator = screen.getByRole("separator")

        // Drag right rail: drag starts at 300, move left to 200 (delta = 300 - 200 = +100 -> width 400)
        fireEvent.pointerDown(separator, { clientX: 300, button: 0 })
        fireEvent.pointerMove(separator, { clientX: 200 })
        fireEvent.pointerUp(separator)

        expect(window.localStorage.getItem(`${storageKey}.width`)).toBe("400")
        expect(window.localStorage.getItem(storageKey)).toBe("0")

        // Double click to collapse
        fireEvent.doubleClick(separator)
        expect(window.localStorage.getItem(storageKey)).toBe("1")
    })

    it("restores width and collapsed preference from localStorage on mount", () => {
        const storageKey = "test.restore.rail"
        window.localStorage.setItem(storageKey, "1")
        window.localStorage.setItem(`${storageKey}.width`, "360")

        render(
            <DrawerResizableRail
                side="left"
                storageKey={storageKey}
                defaultWidth={250}
                minWidth={200}
                maxWidth={400}
                compactWidth={56}
                collapsedContent={<div>Restored Compact</div>}
            >
                <div>Restored Full</div>
            </DrawerResizableRail>
        )

        expect(screen.getByText("Restored Compact")).toBeInTheDocument()
        const aside = screen.getByTestId("drawer-resizable-rail-left")
        expect(aside).toHaveStyle({ width: "56px" })
    })
})
