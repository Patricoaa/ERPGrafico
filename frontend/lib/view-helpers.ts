"use client"

import React, { useState, useCallback } from "react"
import { Table as ReactTable, type Row, type VisibilityState } from "@tanstack/react-table"
import { DomainCard, EntityCard, EmptyState, MoneyDisplay, resolveEmptyState, type DataTableEmptyState, type EntityCardSkeletonProps } from "@/components/shared"
import { groupByDate } from "@/lib/group-by-date"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, Upload, ChevronDown, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"

// Full-height centered wrapper so card-grid empty states fill the canvas,
// matching the table empty-state behavior.
const CARD_EMPTY_WRAPPER = "flex h-full min-h-[12rem] items-center justify-center"

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
    emptyState?: DataTableEmptyState
    isFiltered?: boolean
  }
) {
  const DomainCardView = (table: ReactTable<any>) => {
    const rows = table.getRowModel().rows
    if (rows.length === 0) {
      const resolved = resolveEmptyState(options.emptyState, options.isFiltered)
      return React.createElement(
        "div",
        { className: CARD_EMPTY_WRAPPER },
        React.createElement(EmptyState, {
          context: resolved.context,
          icon: resolved.icon,
          title: resolved.title,
          description: resolved.description,
          action: resolved.action,
          className: "h-full w-full",
        })
      )
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
  DomainCardView.displayName = "DomainCardView"
  return DomainCardView
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
    emptyState?: DataTableEmptyState
    isFiltered?: boolean
  }
) {
  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy
  const layout = options.gridLayout ?? policy?.gridLayout ?? 'single-column'

  const gridClass = layout === 'multi-column'
    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2"
    : "grid gap-3 pt-2"

  const EntityCardView = (table: ReactTable<any>) => {
    const rows = table.getRowModel().rows
    if (rows.length === 0) {
      const resolved = resolveEmptyState(options.emptyState, options.isFiltered)
      return React.createElement(
        "div",
        { className: CARD_EMPTY_WRAPPER },
        React.createElement(EmptyState, {
          context: resolved.context,
          icon: resolved.icon,
          title: resolved.title,
          description: resolved.description,
          action: resolved.action,
          className: "h-full w-full",
        })
      )
    }
    return React.createElement(
      "div",
      { className: gridClass },
      rows.map((row) => {
        const node = options.renderCard(row.original, row)
        if (React.isValidElement(node)) {
          return React.cloneElement(node, { key: (row.original as any).id ?? row.id } as any)
        }
        return node
      })
    )
  }
  EntityCardView.displayName = "EntityCardView"
  return EntityCardView
}

/**
 * Creates a renderCustomView function for date-grouped card views.
 * Groups cards by date with sticky headers showing date label + total sum.
 * Complements SegmentationBar (which filters data at API level) by organizing
 * already-filtered cards visually on screen.
 *
 * Usage:
 *   renderCustomView={isCustomView ? createCardGroupView({
 *     renderCard: (m) => <EntityCard key={m.id}>...</EntityCard>,
 *     cardGroupBy: { dateField: 'date', amountField: 'amount' },
 *     gridLayout: 'single-column',
 *   }) : undefined}
 */
export function createCardGroupView<TData>(
  options: {
    renderCard: (data: TData) => React.ReactNode
    cardGroupBy: {
      dateField: string
      amountField?: string
    }
    gridLayout?: "single-column" | "multi-column"
    emptyState?: DataTableEmptyState
    isFiltered?: boolean
  },
) {
  const {
    renderCard,
    cardGroupBy,
    gridLayout = "single-column",
    emptyState,
    isFiltered,
  } = options

  const innerGridClass =
    gridLayout === "multi-column"
      ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
      : "grid gap-2"

  const GroupedCardView = (table: ReactTable<TData>) => {
    const rows = table.getRowModel().rows
    if (rows.length === 0) {
      const resolved = resolveEmptyState(emptyState, isFiltered)
      return React.createElement(
        "div",
        { className: "flex h-full min-h-[12rem] items-center justify-center" },
        React.createElement(EmptyState, {
          context: resolved.context,
          icon: resolved.icon,
          title: resolved.title,
          description: resolved.description,
          action: resolved.action,
          className: "h-full w-full",
        }),
      )
    }

    const data = rows.map((r) => r.original)
    const groups = groupByDate(data, cardGroupBy.dateField, cardGroupBy.amountField)

    return React.createElement(
      "div",
      { className: "space-y-1" },
      groups.map((group) =>
        React.createElement(
          "div",
          { key: group.dateKey || "no-date", className: "mb-4" },
          React.createElement(
            "div",
            {
              className:
                "pb-2 pt-3 mb-3",
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(Calendar, {
                className: "h-4 w-4 shrink-0 text-muted-foreground/50",
              }),
              React.createElement(
                "span",
                { className: "text-xs font-semibold text-foreground truncate" },
                group.label,
              ),
              group.sublabel &&
                React.createElement(
                  "span",
                  {
                    className:
                      "hidden sm:inline text-xs text-muted-foreground/50 truncate",
                  },
                  group.sublabel,
                ),
              group.total !== 0 &&
                React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("span", { className: "text-muted-foreground/20" }, "\u00B7"),
                  React.createElement(
                    "span",
                    { className: "text-[10px] font-black uppercase tracking-widest text-muted-foreground/40" },
                    "Total",
                  ),
                  React.createElement(MoneyDisplay, {
                    amount: group.total,
                    showColor: false,
                    className: "text-xs font-bold",
                  }),
                ),
            ),
          ),
          React.createElement(
            "div",
            { className: innerGridClass },
            group.items.map((item) => {
              const node = renderCard(item)
              if (React.isValidElement(node)) {
                return React.cloneElement(node, { key: (item as any).id } as any)
              }
              return node
            }),
          ),
        ),
      ),
    )
  }
  GroupedCardView.displayName = "GroupedCardView"
  return GroupedCardView
}

/**
 * Creates a renderLoadingView for card/grid views using EntityCard.Skeleton.
 *
 * Usage:
 *   renderLoadingView={isCustomView ? createCardLoadingView('single-column', 8) : undefined}
 *   // With section control:
 *   renderLoadingView={createCardLoadingView('single-column', 6, { showBody: false, showFooter: true })}
 */
export function createCardLoadingView(
  layout: 'single-column' | 'multi-column' = 'single-column',
  count: number = 8,
  skeletonProps?: Pick<EntityCardSkeletonProps, 'showHeader' | 'showBody' | 'showFooter'>
) {
  const gridClass = layout === 'multi-column'
    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2"
    : "grid gap-3 pt-1"

  const CardLoadingView = () =>
    React.createElement(
      "div",
      { className: gridClass },
      Array.from({ length: count }).map((_, i) =>
        React.createElement(EntityCard.Skeleton, {
          key: i,
          variant: layout === 'multi-column' ? 'compact' : undefined,
          ...skeletonProps,
        })
      )
    )
  CardLoadingView.displayName = "CardLoadingView"
  return CardLoadingView
}

/**
 * Creates a renderSubComponent callback for DataTable with optional lazy-loading
 * and a built-in loading state. Eliminates the boilerplate of managing expand
 * state + fetch-on-expand per consumer.
 *
 * Usage:
 *   renderSubComponent={createExpandableRowView({
 *     lazyLoad: (row) => fetchDetail(row.id),
 *     renderDetail: (row, detail) => <DetailPanel data={detail} />,
 *   })}
 */
export function createExpandableRowView<TData, TDetail = unknown>(
  config: {
    /** Called when the row expands for the first time. Return a promise for lazy data. */
    lazyLoad?: (row: TData) => Promise<TDetail>
    /** Renders the expanded detail panel. Receives the row data and optional lazy-loaded detail. */
    renderDetail: (row: TData, detail: TDetail | null) => React.ReactNode
    /** Skeleton rows to show while lazyLoad is in-flight. @default 2 */
    skeletonRows?: number
  }
) {
  const cache = new Map<string | number, TDetail | null>()

  function ExpandableRowRenderer({ row }: { row: Row<TData> }) {
    const [detail, setDetail] = useState<TDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const id = (row.original as any).id

    const handleExpand = useCallback(async () => {
      if (!config.lazyLoad) return
      if (cache.has(id)) {
        setDetail(cache.get(id)!)
        return
      }
      setLoading(true)
      try {
        const result = await config.lazyLoad(row.original)
        cache.set(id, result)
        setDetail(result)
      } finally {
        setLoading(false)
      }
    }, [id, row.original])

    React.useEffect(() => {
      handleExpand()
    }, [handleExpand])

    if (loading) {
      const skeletonCount = config.skeletonRows ?? 2
      return React.createElement("div", { className: "p-4 space-y-3" },
        Array.from({ length: skeletonCount }).map((_, i) =>
          React.createElement("div", {
            key: i,
            className: "h-8 bg-muted/30 rounded animate-pulse"
          })
        )
      )
    }

    return config.renderDetail(row.original, detail)
  }
  ExpandableRowRenderer.displayName = "ExpandableRowRenderer"

  const ExpandableRowView = (row: Row<TData>) => React.createElement(ExpandableRowRenderer, { row })
  ExpandableRowView.displayName = "ExpandableRowView"
  return ExpandableRowView
}

/**
 * Creates a renderFooter callback for DataTable that shows column aggregations
 * (sum, count, avg) in the footer row. Useful for ledgers, movement lists,
 * and any numeric report.
 *
 * Usage:
 *   renderFooter={createSimpleFooterView([
 *     { accessorKey: "amount", aggregate: "sum", formatter: formatCurrency },
 *     { accessorKey: "count", aggregate: "count" },
 *   ])}
 */
export function createSimpleFooterView<TData>(
  columns: Array<{
    accessorKey: string
    aggregate?: 'sum' | 'count' | 'avg' | 'none'
    formatter?: (value: number) => string
  }>,
  options?: {
    /** Label for the first column cell. Defaults to "Totales". */
    label?: string
    /** Additional className for the footer row. */
    className?: string
  }
) {
  const label = options?.label ?? "Totales"

  const SimpleFooterView = (table: ReactTable<TData>) => {
    const rows = table.getRowModel().rows

    if (rows.length === 0) return null

    const totalCells = columns.map((col) => {
      if (col.aggregate === 'none' || !col.aggregate) {
        return React.createElement("td", { key: col.accessorKey })
      }

      const values = rows.map((row) => {
        const val = (row.original as Record<string, unknown>)[col.accessorKey]
        return typeof val === 'number' ? val : Number(val) || 0
      })

      let result: number
      if (col.aggregate === 'sum') {
        result = values.reduce((a, b) => a + b, 0)
      } else if (col.aggregate === 'avg') {
        result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
      } else {
        result = values.length
      }

      const display = col.formatter ? col.formatter(result) : result.toLocaleString('es-CL')
      return React.createElement("td", {
        key: col.accessorKey,
        className: "text-right font-mono font-bold tabular-nums table-cell"
      }, display)
    })

    return React.createElement("tr", { className: cn("border-t-2", options?.className) },
      React.createElement("td", { className: "font-black uppercase tracking-widest text-[10px] table-cell" }, label),
      ...totalCells
    )
  }
  SimpleFooterView.displayName = "SimpleFooterView"
  return SimpleFooterView
}

/**
 * Creates a toolbar action dropdown for export/import operations.
 * Standardizes the "Acciones" dropdown pattern used across modules.
 *
 * Usage:
 *   toolbarAction={createExportToolbarAction({
 *     entityLabel: "Movimientos",
 *     onExport: handleExport,
 *     onImport: handleImport,
 *   })}
 */
export function createExportToolbarAction(config: {
  entityLabel?: string
  onExport?: () => void
  onImport?: () => void
}) {
  const hasActions = config.onExport || config.onImport
  if (!hasActions) return null

  return React.createElement(DropdownMenu, null,
    React.createElement(DropdownMenuTrigger, { asChild: true },
      React.createElement(Button, {
        variant: "outline",
        size: "sm",
        className: "h-9 gap-2 text-[10px] font-black uppercase tracking-widest"
      },
        "Acciones",
        React.createElement(ChevronDown, { className: "h-3.5 w-3.5" })
      )
    ),
    React.createElement(DropdownMenuContent, { align: "end", className: "min-w-[180px]" },
      config.onExport && React.createElement(DropdownMenuItem, { onClick: config.onExport },
        React.createElement(Download, { className: "h-4 w-4 mr-2" }),
        `Exportar ${config.entityLabel || 'datos'}`
      ),
      config.onImport && React.createElement(DropdownMenuItem, { onClick: config.onImport },
        React.createElement(Upload, { className: "h-4 w-4 mr-2" }),
        `Importar ${config.entityLabel || 'datos'}`
      )
    )
  )
}

/**
 * Creates an initialColumnVisibility preset from common visibility patterns.
 * Reduces boilerplate when configuring which columns to show by default.
 *
 * @param preset - 'all' shows all columns; 'essential' hides audit/technical fields;
 *                 'financial' shows only monetary + date columns.
 *
 * Usage:
 *   initialColumnVisibility={createColumnVisibilityPreset('essential')}
 */
export function createColumnVisibilityPreset(
  preset: 'all' | 'essential' | 'financial'
): VisibilityState {
  switch (preset) {
    case 'all':
      return {}
    case 'essential':
      return {
        id: true,
        created_at: false,
        updated_at: false,
        created_by: false,
        updated_by: false,
      }
    case 'financial':
      return {
        id: false,
        created_at: false,
        updated_at: false,
        created_by: false,
        updated_by: false,
        notes: false,
        reference: false,
      }
  }
}
