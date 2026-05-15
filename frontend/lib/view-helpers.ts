"use client"

import React from "react"
import { Table as ReactTable } from "@tanstack/react-table"
import { DomainCard } from "@/components/shared/DomainCard"
import { EntityCard } from "@/components/shared/EntityCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"

/**
 * Creates a renderCustomView function for entities that use DomainCard (workflow entities).
 * Eliminates the ~25 lines of duplicated renderCustomView boilerplate per consumer.
 *
 * Usage:
 *   renderCustomView={isCustomView ? createDomainCardView('sales.saleorder', {
 *     onRowClick: handleRowClick,
 *     isSelected: (data) => hubConfig?.orderId === data.id,
 *     isHubOpen,
 *   }) : undefined}
 */
export function createDomainCardView(
  entityLabel: string,
  options: {
    onRowClick: (data: any) => void
    isSelected?: (data: any) => boolean
    isHubOpen?: boolean
  }
) {
  return (table: ReactTable<any>) => {
    const rows = table.getRowModel().rows
    if (rows.length === 0) {
      const meta = ENTITY_REGISTRY[entityLabel]
      return React.createElement(EmptyState, {
        context: "search" as const,
        title: `No se encontraron ${meta?.titlePlural?.toLowerCase() || 'resultados'}`,
        description: "Ajusta los filtros o el rango de fechas para encontrar lo que buscas.",
      })
    }
    return React.createElement(
      "div",
      { className: "grid gap-3 pt-1" },
      rows.map((row) =>
        React.createElement(DomainCard, {
          key: row.original.id,
          label: entityLabel,
          data: row.original,
          isSelected: options.isSelected?.(row.original) ?? false,
          isHubOpen: options.isHubOpen ?? false,
          onClick: () => options.onRowClick(row.original),
          visibleColumns: table.getState().columnVisibility,
        })
      )
    )
  }
}

/**
 * Creates a renderCustomView function for entities that use EntityCard.
 * The consumer provides a renderCard function for domain-specific card content.
 *
 * Usage:
 *   renderCustomView={isCustomView ? createEntityCardView('inventory.product', {
 *     gridLayout: 'multi-column',
 *     renderCard: (data, row) => <EntityCard>...</EntityCard>,
 *   }) : undefined}
 */
export function createEntityCardView(
  entityLabel: string,
  options: {
    renderCard: (data: any, row: any) => React.ReactNode
    gridLayout?: 'single-column' | 'multi-column'
  }
) {
  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy
  const layout = options.gridLayout ?? policy?.gridLayout ?? 'single-column'

  const gridClass = layout === 'multi-column'
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-2"
    : "grid gap-3 pt-2"

  return (table: ReactTable<any>) => {
    const rows = table.getRowModel().rows
    if (rows.length === 0) {
      const meta = ENTITY_REGISTRY[entityLabel]
      return React.createElement(EmptyState, {
        context: "search" as const,
        title: `No se encontraron ${meta?.titlePlural?.toLowerCase() || 'resultados'}`,
        description: "Ajusta los filtros para encontrar lo que buscas.",
      })
    }
    return React.createElement(
      "div",
      { className: gridClass },
      rows.map((row) => {
        const node = options.renderCard(row.original, row)
        return node
      })
    )
  }
}

/**
 * Creates a renderLoadingView for card/grid views using EntityCard.Skeleton.
 * 
 * Usage:
 *   renderLoadingView={isCustomView ? createCardLoadingView('single-column', 8) : undefined}
 */
export function createCardLoadingView(
  layout: 'single-column' | 'multi-column' = 'single-column',
  count: number = 8
) {
  const gridClass = layout === 'multi-column'
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-2"
    : "grid gap-3 pt-1"

  return () =>
    React.createElement(
      "div",
      { className: gridClass },
      Array.from({ length: count }).map((_, i) =>
        React.createElement(EntityCard.Skeleton, {
          key: i,
          variant: layout === 'multi-column' ? 'compact' : undefined,
        })
      )
    )
}
