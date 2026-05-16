"use client"

/**
 * Thin adapter that bridges @tanstack/react-table Column API with the
 * standalone FacetedFilter component from shared/. This file only exists
 * as an integration layer for DataTable — use shared/FacetedFilter directly
 * for non-table use cases.
 */
import * as React from "react"
import { Column } from "@tanstack/react-table"
import { FacetedFilter } from "@/components/shared/FacetedFilter"

interface DataTableFacetedFilterProps<TData, TValue> {
    column?: Column<TData, TValue>
    title?: string
    options: {
        label: string
        value: string
        icon?: React.ComponentType<{ className?: string }>
    }[]
}

export function DataTableFacetedFilter<TData, TValue>({
    column,
    title,
    options,
}: DataTableFacetedFilterProps<TData, TValue>) {
    const selectedValues = Array.from(
        (column?.getFilterValue() as string[]) ?? []
    )

    return (
        <FacetedFilter
            title={title}
            options={options}
            selectedValues={selectedValues}
            onSelect={(values) =>
                column?.setFilterValue(values.length ? values : undefined)
            }
        />
    )
}
