"use client"

import React from "react"
import type { Table as ReactTable, Row, VisibilityState } from "@tanstack/react-table"
import { EntityCard, EmptyState, resolveEmptyState, SkeletonShell, type DataTableEmptyState, type EntityCardSkeletonProps } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { groupByDate, groupItems, type Group } from "@/lib/group-utils"

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

interface InjectedCardProps {
  key?: React.Key
  entityLabel?: string
  selectable?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  isAnySelected?: boolean
  onClick?: () => void
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
    renderCard: (data: Record<string, unknown>, row: Row<Record<string, unknown>>, table?: ReactTable<Record<string, unknown>>) => React.ReactNode
    gridLayout?: 'single-column' | 'multi-column'
    emptyState?: DataTableEmptyState
    isFiltered?: boolean
    skeleton?: Pick<EntityCardSkeletonProps, 'showHeader' | 'showBody' | 'showFooter'>
    hasBulkActions?: boolean
  }
) {
  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy
  const layout = options.gridLayout ?? policy?.gridLayout ?? 'single-column'
  const gridClass = layout === 'multi-column'
    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2"
    : "grid gap-3 pt-2"

  const EntityCardView = (table: ReactTable<Record<string, unknown>>) => {
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
          entityLabel: resolved.entityLabel,
          className: "h-full w-full",
        })
      )
    }
    const isAnySelected = table.getSelectedRowModel().rows.length > 0

    return React.createElement(
      "div",
      { className: gridClass },
      rows.map((row) => {
        const node = options.renderCard(row.original, row, table)
        if (React.isValidElement(node)) {
          const originalOnClick = (node.props as Record<string, unknown>).onClick as (() => void) | undefined
          const isChecked = row.getIsSelected()

          const injectedProps: InjectedCardProps = {
            key: (row.original as Record<string, unknown>).id as React.Key ?? row.id,
            entityLabel,
          }

          if (options.hasBulkActions) {
            injectedProps.selectable = true
            injectedProps.checked = isChecked
            injectedProps.onCheckedChange = (checked: boolean) => row.toggleSelected(checked)
            injectedProps.isAnySelected = isAnySelected
            injectedProps.onClick = () => {
              if (isAnySelected) {
                row.toggleSelected()
              } else if (originalOnClick) {
                originalOnClick()
              }
            }
          }

          return React.cloneElement(node, injectedProps)
        }
        return node
      })
    )
  }
  EntityCardView.displayName = "EntityCardView"
  return EntityCardView
}

export function createCardGroupView<TData>(
  options: {
    renderCard: (data: TData, row?: Row<TData>, table?: ReactTable<TData>) => React.ReactNode
    cardGroupBy: {
      field: string
      sort?: 'asc' | 'desc'
      labelFn?: (key: string, rawKey: unknown, items: TData[]) => { label: string; sublabel?: string }
      defaultLabel?: string
    }
    gridLayout?: "single-column" | "multi-column"
    emptyState?: DataTableEmptyState
    isFiltered?: boolean
    hasBulkActions?: boolean
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

  const hasDateField = cardGroupBy.field.toLowerCase().includes("date")

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
          entityLabel: resolved.entityLabel,
          className: "h-full w-full",
        }),
      )
    }

    const data = rows.map((r) => r.original)

    let groups: Group<TData>[]
    if (cardGroupBy.labelFn) {
      groups = groupItems(data, cardGroupBy.field, {
        sort: cardGroupBy.sort,
        defaultLabel: cardGroupBy.defaultLabel,
        labelFn: cardGroupBy.labelFn as (key: string, rawKey: unknown, items: TData[]) => { label: string; sublabel?: string },
      })
    } else if (hasDateField) {
      groups = groupByDate(data, cardGroupBy.field)
    } else {
      groups = groupItems(data, cardGroupBy.field, {
        sort: cardGroupBy.sort,
        defaultLabel: cardGroupBy.defaultLabel,
      })
    }

    const isAnySelected = table.getSelectedRowModel().rows.length > 0

    return React.createElement(
      "div",
      { className: "space-y-1" },
      groups.map((group) =>
        React.createElement(
          "div",
          { key: group.key || "no-key", className: "mb-4" },
          React.createElement(
            "div",
            { className: "pb-2 pt-3 mb-3" },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              hasDateField &&
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
                  { className: "hidden sm:inline text-xs text-muted-foreground/50 truncate" },
                  group.sublabel,
                ),
            ),
          ),
          React.createElement(
            "div",
            { className: innerGridClass },
            group.items.map((item) => {
              const row = rows.find(r => (r.original as Record<string, unknown>).id === (item as Record<string, unknown>).id)
              const node = renderCard(item, row, table)
              if (React.isValidElement(node)) {
                const originalOnClick = (node.props as Record<string, unknown>).onClick as (() => void) | undefined
                const injectedProps: InjectedCardProps = {
                  key: (item as Record<string, unknown>).id as React.Key,
                }

                if (options.hasBulkActions && row) {
                  const isChecked = row.getIsSelected()
                  injectedProps.selectable = true
                  injectedProps.checked = isChecked
                  injectedProps.onCheckedChange = (checked: boolean) => row.toggleSelected(checked)
                  injectedProps.isAnySelected = isAnySelected
                  injectedProps.onClick = () => {
                    if (isAnySelected) {
                      row.toggleSelected()
                    } else if (originalOnClick) {
                      originalOnClick()
                    }
                  }
                }

                return React.cloneElement(node, injectedProps)
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
 *   // With cardVariant from registry:
 *   renderLoadingView={createCardLoadingView('single-column', 8, undefined, 'compact')}
 */
export function createCardLoadingView(
  layout: 'single-column' | 'multi-column' = 'single-column',
  count: number = 8,
  skeletonProps?: Pick<EntityCardSkeletonProps, 'showHeader' | 'showBody' | 'showFooter'>,
  cardVariant?: 'highlights' | 'summary' | 'full' | 'workflow',
) {
  const gridClass = layout === 'multi-column'
    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2"
    : "grid gap-3 pt-1"

  const isCompact = cardVariant === 'highlights' || cardVariant === 'summary'
  const effectiveSkeletonProps = isCompact
    ? { ...skeletonProps, showBody: false, showFooter: false }
    : skeletonProps

  const CardLoadingView = () =>
    React.createElement(
      "div",
      { className: gridClass },
      Array.from({ length: count }).map((_, i) =>
        React.createElement(EntityCard.Skeleton, {
          key: i,
          variant: isCompact || layout === 'multi-column' ? 'compact' : undefined,
          ...effectiveSkeletonProps,
        })
      )
    )
  CardLoadingView.displayName = "CardLoadingView"
  return CardLoadingView
}

/**
 * Creates a renderLoadingView for grouped card views (createCardGroupView).
 * Wraps in SkeletonShell and renders group headers + EntityCard.Skeleton cards
 * to match the grouped layout and avoid layout shift.
 *
 * Usage:
 *   renderLoadingView={createCardGroupLoadingView({ gridLayout: 'multi-column' })}
 */
export function createCardGroupLoadingView(
  options?: {
    groupCount?: number
    itemsPerGroup?: number
    gridLayout?: 'single-column' | 'multi-column'
    skeletonProps?: Pick<EntityCardSkeletonProps, 'showHeader' | 'showBody' | 'showFooter'>
    cardVariant?: 'highlights' | 'summary' | 'full' | 'workflow'
  }
) {
  const {
    groupCount = 3,
    itemsPerGroup = 2,
    gridLayout = 'single-column',
    skeletonProps,
    cardVariant,
  } = options ?? {}

  const isCompact = cardVariant === 'highlights' || cardVariant === 'summary'
  const effectiveSkeletonProps = isCompact
    ? { ...skeletonProps, showBody: false, showFooter: false }
    : skeletonProps

  const innerGridClass = gridLayout === "multi-column"
    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
    : "grid gap-2"

  const CardGroupLoadingView = () =>
    React.createElement(
      SkeletonShell,
      { isLoading: true, ariaLabel: "Cargando..." },
      Array.from({ length: groupCount }).map((_, i) =>
        React.createElement(
          "div",
          { key: `skel-group-${i}`, className: "mb-4" },
          React.createElement(
            "div",
            { className: "pb-2 pt-3 mb-3" },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(Calendar, { className: "h-4 w-4 shrink-0 text-muted-foreground/50" }),
              React.createElement(
                "span",
                { className: "text-xs font-semibold text-foreground truncate" },
                React.createElement(Skeleton, { className: "h-4 w-24 inline-block" }),
              ),
              React.createElement(
                "span",
                { className: "hidden sm:inline text-xs text-muted-foreground/50 truncate" },
                React.createElement(Skeleton, { className: "h-3 w-16 inline-block" }),
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: innerGridClass },
            Array.from({ length: itemsPerGroup }).map((_, j) =>
              React.createElement(EntityCard.Skeleton, {
                key: `skel-card-${i}-${j}`,
                variant: isCompact || gridLayout === 'multi-column' ? 'compact' : undefined,
                ...effectiveSkeletonProps,
              })
            ),
          ),
        )
      ),
    )
  CardGroupLoadingView.displayName = "CardGroupLoadingView"
  return CardGroupLoadingView
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
      React.createElement("td", { className: "font-bold uppercase tracking-widest text-3xs table-cell" }, label),
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
        className: "h-9 gap-2 text-3xs font-bold uppercase tracking-widest"
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
