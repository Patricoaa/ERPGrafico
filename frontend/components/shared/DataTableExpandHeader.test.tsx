import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { useReactTable, getCoreRowModel, getExpandedRowModel, type ExpandedState, type ColumnDef } from "@tanstack/react-table"
import { describe, it, expect } from "vitest"
import { DataTableExpandHeader } from "./DataTableExpandHeader"

interface Row {
    id: string
    label: string
    children?: Row[]
}

const DATA: Row[] = [
    { id: "1", label: "Parent", children: [{ id: "1.1", label: "Child" }] },
]

const COLUMNS: ColumnDef<Row>[] = [{ accessorKey: "label" }]

function Harness({ initialExpanded = true, className }: { initialExpanded?: boolean; className?: string }) {
    const [expanded, setExpanded] = useState<ExpandedState>(initialExpanded ? true : {})
    const table = useReactTable({
        data: DATA,
        columns: COLUMNS,
        state: { expanded },
        onExpandedChange: setExpanded,
        getSubRows: (row) => row.children,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
    })
    return (
        <>
            <table>
                <tbody>
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                            <td>{row.original.label}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <DataTableExpandHeader table={table} className={className} />
        </>
    )
}

describe("DataTableExpandHeader", () => {
    it("shows ChevronDown when all rows are expanded", () => {
        render(<Harness initialExpanded />)
        expect(screen.getByTitle("Contraer todo")).toBeInTheDocument()
    })

    it("shows ChevronRight when rows are collapsed", () => {
        render(<Harness initialExpanded={false} />)
        expect(screen.getByTitle("Expandir todo")).toBeInTheDocument()
    })

    it("toggles all rows on click", async () => {
        const user = userEvent.setup()
        render(<Harness initialExpanded />)
        expect(screen.getByText("Child")).toBeInTheDocument()

        await user.click(screen.getByTitle("Contraer todo"))
        expect(screen.queryByText("Child")).not.toBeInTheDocument()
        expect(screen.getByTitle("Expandir todo")).toBeInTheDocument()

        await user.click(screen.getByTitle("Expandir todo"))
        expect(screen.getByText("Child")).toBeInTheDocument()
        expect(screen.getByTitle("Contraer todo")).toBeInTheDocument()
    })

    it("applies className to the button", () => {
        render(<Harness className="custom-class" />)
        expect(screen.getByTitle("Contraer todo")).toHaveClass("custom-class")
    })
})
